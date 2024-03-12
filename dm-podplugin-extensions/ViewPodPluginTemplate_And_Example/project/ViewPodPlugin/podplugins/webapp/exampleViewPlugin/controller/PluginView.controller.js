// Start all sfc's in an Order , validate components, complete all Sfcs : customer-> Lutron
sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/base/Log"
], function (JSONModel, Fragment, PluginViewController, Log) {
    "use strict";
    //TODO Break this into multiple modules with well defined dependencies
    // Then import into this main module for the plugin
    //TODO convert promise "then" chaining into async , wait structure

    var oLogger = Log.getLogger("Lutron View Plugin", Log.Level.INFO);
    //------------------------------------------------------------------------
    //  add a wrklstcurrentsel to receive the selected row on the worklist 
    // (this is includes Operation that is missing from the selectionModel for some reason)
    //  this will be global var in this POD context
    // this object is updated everytime that the selection on the worklist is changed
    // the loadModel  is updated to merge this object into the model in the view

    var wrklstcurrentsel = {}, wrklstsopersel = "notset";
    var glbStack = [];
    // TODO temporary to debug and until a release version
    // Bad practice
    //TODO Make sure this is fixed before the release of the plugin
    var _glbstartableSFCObj = {
        _sfcGoodToStart: [],
        _glbGetsfcGoodToStart: function () { return this._sfcGoodToStart },
        _glbAdd: function (sObj) { this._sfcGoodToStart.push(sObj) },
        _glbErase: function () { this._sfcGoodToStart = [] },
        _glbSet: function (sobj) { this._sfcGoodToStart = sobj },
    }

    //Simple state machine nodes for the Lutron plugin flow
    const LPNS = -1;
    const INIT_LP = 0;
    const START_ORDER_ON = 1;
    const START_ORDER_WORKING = 2;
    const START_ORDER_DONE = 3;
    const VALIDATE_COMP_ON = 4;
    const VALIDATE_COMP_DONE = 5;
    const COMPLETE_ORDER_ON = 6;
    const COMPLETE_ORDER_WORKING = 7;
    const COMPLETE_ORDER_DONE = 8;


    //HIDE CODE  for debug    
    const EXECUTE_CODE = true;
    const ENABLE_NTFCMSG = false;
    //USE ENABLE_PROMISE to use promise.all to resolve all promises that
    // are called in a loop as in case of getting the SFC status.
    const ENABLE_PROMISE_ALL = true;
    // start with 50 increase inremenenatally after tests to test stability.
    const SFCS_CHUNK = 50;  //dont make this greater than 499 for calling sfc/sfcs/start - move to POD Designer.
    const SFCS_NEW = 401;
    const SFCS_INQUE = 402;
    const SFCS_ACTIVE = 403;
    const SFCS_ONHOLD = 404;
    const SFCS_DONE = 405;
    const SFCS_DONE_HOLD = 406;
    const SFCS_SCRAPPED = 407;
    const SFCS_INVALID = 408;
    const SFCS_DELETED = 409;


    //--------------------------------------------------------------------------

    var oPluginViewController = PluginViewController.extend("illumiti.ext.viewplugins.exampleViewPlugin.controller.PluginView", {
        metadata: {
            properties: {
            }
        },

        onInit: function () {
            if (PluginViewController.prototype.onInit) {
                PluginViewController.prototype.onInit.apply(this, arguments);
            }
        },

        /**
         * @see PluginViewController.onBeforeRenderingPlugin()
         */
        onBeforeRenderingPlugin: function () {
            // subscribe on POD events
            //OnPodSelectionChangeEvent , onOperationChangeEvent, onWorkListChangeEvent add other events if needed
            //-----------------------------------
            this.subscribe("PodSelectionChangeEvent", this.onPodSelectionChangeEvent, this);
            this.subscribe("OperationListSelectEvent", this.onOperationChangeEvent, this);
            this.subscribe("WorklistSelectEvent", this.onWorkListSelectEvent, this);
            var oConfig = this.getConfiguration();

            // check if close icon should be displayed
            //Configured in the POD Designer 
            this.configureNavigationButtons(oConfig);
        },

        onExit: function () {
            if (PluginViewController.prototype.onExit) {
                PluginViewController.prototype.onExit.apply(this, arguments);
            }
            // unsubscribe from POD events on exit
            this.unsubscribe("PodSelectionChangeEvent", this.onPodSelectionChangeEvent, this);
            this.unsubscribe("OperationListSelectEvent", this.onOperationChangeEvent, this);
            this.unsubscribe("WorklistSelectEvent", this.onWorkListSelectEvent, this);
        },

        onBeforeRendering: function () {
            this.loadModel();
            //this.stateMachineLutronProcess(INIT_LP);
        },

        onAfterRendering: function () {
            console.log('after Rendering');
        },

        onPodSelectionChangeEvent: function (sChannelId, sEventId, oData) {
            console.log("PodSelectionChangeEvent");
            // don't process if same object firing event
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            this.loadModel();
        },

        onOperationChangeEvent: function (sChannelId, sEventId, oData) {
            console.log("OperationChange Event");

            // don't process if same object firing event
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            this.loadModel();
        },

        // When Worklist selection event fires , get all the info needed by the plugin
        //calling the this.loadModel() function
        //We need to extract the operation from the oData

        onWorkListSelectEvent: function (sChannelId, sEventId, oData) {
            //get the data from the worklist selection row into wklstcurrentsel
            //get the operation into wrklstsopersel
            wrklstcurrentsel = oData;
            wrklstsopersel = oData.selections[0].operation ? oData.selections[0].operation : "notset";

            //this.stateMachineLutronProcess(START_ORDER_ON);
            // don't process if same object firing event
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            // loadModel first since it creates a model from scratch 
            this.loadModel();
        },

        _getWorkListSelectedOperationGlb: function () {
            return wrklstsopersel;
        },
        _getWorkListSelectedRowDataGlb: function () {
            return wrklstcurrentsel;
        },
        //TODO this needs fixing is not working as it should 
        _debugGlb: function (m, b) {

            try {
                var param = b ? b : "";
                var param0 = m ? m : "info:"

                oLogger.info(param0 + " : " + "  param:" + param);


            } catch (error) {
                oLogger.info("Error which is (propably circular dependency ):");
            } finally {
                // the statement below gets the the full json model in
                //javascript format.
                //for a breakpoint in the debugger
                //TODO remove eventually
                var theModel = this.getView().getModel().getData();
            }
        },

        _debugWrklstOperSelected() {
            this._debugGlb("wrklstpersel", wrklstcurrentsel);

        },
        /****************************************************************
         * 
         *                  APIs DM and Derivatives
         *
         *****************************************************************/

        //--------------------- SignOFSfcs -------------------------------
        signOffSfcs: async function (psfcs) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/signoff?async=false";
            var sfcplant = this.getPodController().getUserPlant();
            var sfcOperation = this._getWorkListSelectedOperationGlb();
            var sfcResource = this.getPodSelectionModel().getResource().getResource();

            var oView = this.getView();
            var oModel = oView.getModel();
            var oOrder = oModel.getProperty('/orderselect');
            //theOrder=this.getView().getModel().getProperty('/orderselect');
            console.log(`order: ${oOrder}`);

            var ssfcParameters = {
                plant: sfcplant,
                operation: sfcOperation,
                resource: sfcResource,
                sfcs: psfcs
                //sfcs: null,
                //processLot: null
                // dateTime:""
            }
            var that = this;
            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            that.showSuccessMessage("Signoff done", true);
                            //oLogger.info("compolete success");
                            resolve(oResponseData);
                        },
                        //The error call back for the /classification/v1/read
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("Signoff   API call failed " + sHttpErrorMessage);
                            that.showErrorMessage(oError, true);
                            reject(oError);
                        })
                });
                return oResponseData;
            } catch (error) {
            }
        },

        /** getComponentsForSfc
        * 
        * @returns a promise that if resolved contains the components
        *  for the sfc in the selection Model and plant
        * In summary this function should be used inside POD Plugins only
        * the resolved promise result is of the format of an array
        * [
        *      {
        *          component:'value text',
        *          componentVersion    :'component version text',
        *          componentDescription:'ComponentDescription text',
        *          operationActivity   :'operation Activity text',
        *          plant               :'plant text'
        *      },
        *      {
        *      },
        *      .
        *      .
        * ]
        * 
        * ]
        * 
        */
        getComponentsForSfc: async function () {
            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    var sUrl = this.getPublicApiRestDataSourceUri() + "/assembly/v1/plannedComponents";
                    var selection = this.getPodSelectionModel().getSelections();
                    var thesfc = selection[0].getSfc().getSfc();
                    var thePlant = this.getPodController().getUserPlant();

                    if (!thePlant || !thePlant) {
                        console.log("we have not made a selection")
                        return;
                    }

                    var params = {
                        plant: thePlant,
                        sfc: thesfc
                    }
                    this.ajaxGetRequest(sUrl, params, function (oResponseData) {
                        resolve(oResponseData);
                    }, function (Error) {
                        reject(Error);
                    });
                });
                return oResponseData;
            } catch (error) {

            }
        },

        getSfcStatus: async function (thesfc) {
            var theplant = this.getPodController().getUserPlant();
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcdetail";
            var params = {
                plant: theplant,
                sfc: thesfc
            };
            var that = this;
            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    that.ajaxGetRequest(sUrl, params, function (oResponseData) {
                        resolve(oResponseData);
                    }, function (Error, sHttpErrorMessage) {
                        reject(Error);
                    });
                });
                return oResponseData;
            } catch (error) {

            }
        },
        // --
        //  SfcStatusIsStartable wraps the calls to sfc/detail API in a promise
        // -- and makes it possible to use asyc - wait 
        // 
        // Returns a promise that has true if the passed sfc is startable
        // false if it is not
        // TODO factor out the API call /sfc/v1/sfcdetail on its own
        // Then call this and do the status comparisons on the resolved API call.

        getSfcStatusIsStartable: async function (thesfc) {

            try {

                var oResponseData = await this.getSfcStatus(thesfc);
                var code = oResponseData.status.code;
                var sfcsWithCodeStartable = (code == SFCS_NEW || code == SFCS_INQUE) ? oResponseData.sfc : "";
                var goodToStart = (code == SFCS_NEW || code == SFCS_INQUE) ? true : false;
                // we want to push this to the model
                console.log("status code=" + code);
                var tm = this.getView().getModel().getProperty("/startableSFCs");
                if (sfcsWithCodeStartable) {
                    tm.push(sfcsWithCodeStartable);
                    this.getView().getModel().setProperty("/startableSFCs", tm);
                    //this._debugGlb("Setting tm in the model after validate called", tm);
                }
                var result = tm;
                return goodToStart;
            }
            catch (error) {
            }
        },
        // ------------------ End getSfcStatusIsStartable --------
        //--
        //---------------------- classificationRead -----------------
        classificationRead: async function (imaterial) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/classification/v1/read";
            var sfcplant = this.getPodController().getUserPlant();
            var oObjectKeys = [];
            if (imaterial) {
                oObjectKeys.push(imaterial);
            } else {
                var pmaterial = this.getView().getModel().getProperty("/material");
                oObjectKeys.push(pmaterial);
                console.log("ObjectKeyss=" + oObjectKeys);
            }

            //TODO Using the wrong paramaters here 
            // for getting the criteria for validate component or not.
            var ssfcParameters = {
                plant: sfcplant,
                objectKeys: oObjectKeys,
                objectType: "MATERIAL", //Material
                classType: "001",
                classes: ["Z_MATERIAL_DM"]


            }
            var that = this;
            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            that.showSuccessMessage("classication called  succesfully!", true);
                            //oLogger.info("classification call success");
                            resolve(oResponseData);
                        },
                        //The error call back for the /classification/v1/read
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("Classsication API call failed " + sHttpErrorMessage);
                            that.showErrorMessage(oError, true);
                            reject(oError);
                        })
                });
                return oResponseData;
            } catch (error) {

            }

        },
        //--------------------- End classificationRead ---------------

        //--
        //------------------  completeOrderSfcs ------------------
        completeOrderSfcs: async function (psfcs) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/complete?async=false";
            var sfcplant = this.getPodController().getUserPlant();
            var sfcOperation = this._getWorkListSelectedOperationGlb();
            var sfcResource = this.getPodSelectionModel().getResource().getResource();

            var ssfcParameters = {
                plant: sfcplant,
                operation: sfcOperation,
                quantity: 1,
                resource: sfcResource,
                sfcs: psfcs
                //,processLot:"""



            }
            try {
                var that = this;
                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            //that.showSuccessMessage("complete done", true);
                            //oLogger.info("compolete success");
                            resolve(oResponseData);
                        },
                        //The error call back for the sfc/v1/sfcs/complete?async=false"
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("Complete  API call failed " + sHttpErrorMessage);
                            // that.showErrorMessage(oError, true);
                            reject(oError);
                        })
                });
                return oResponseData;
            } catch (error) {

            }

        },
        //-----------------------End CompleteOrderSfcs -------------------

        //---
        // --------------------- startAllSfcs-----------------------------
        // It starts all sfcs in the passed array at Plant ,Operation , 
        //quantity and Resource
        // It will ***fail*** if the sfcs in the list are not startable(status.code == New(401) or Inqueque(402))
        // It returns a Promise with all the started sfcs if succesfull

        startAllSfcs: async function (
            sOperation,
            sPlant,
            sResource,
            sQuantity,
            sSfcs) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/start?async=false";
            //var sfcplant = this.getPodController().getUserPlant();
            //var sfcOperation = this._getWorkListSelectedOperationGlb(); //gloabal ch..ch..
            //var sfcResource = this.getPodSelectionModel().getResource().getResource();

            var ssfcParameters = {
                plant: sPlant,
                operation: sOperation,
                quantity: 1, //TODO find the quantity 
                resource: sResource,
                sfcs: sSfcs //,
                // processLot:""
            }
            var that = this;
            try {

                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            that.showSuccessMessage("Order Started succesfully!", true);
                            //oLogger.info("Orderstart success");
                            resolve(oResponseData);
                        },
                        //The error call back for the /sfc/sfcs/start API call
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("Errors - sfc start  " + sHttpErrorMessage);
                            that.showErrorMessage(oError, true);
                            reject(oError);
                        });
                });
                return oResponseData;
            } catch (error) {

            }

        },
        // ----- End startAllSfcs async

        /** TODO too narrow use of the API it will be better to get the full response in an Object 
         * and use the object to get the SFCs and other properties included in the response
         * 
         */


        getAllSfcsInOrder: async function (porder) {
            var ePlant = this.getPodController().getUserPlant();
            var sUrl = this.getPublicApiRestDataSourceUri() + "/order/v1/orders";
            oLogger.info("sUrl : " + sUrl);
            //Set the parameters
            var oParameters = {
                order: porder,
                plant: ePlant
            };
            var that = this;

            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxGetRequest(
                        sUrl,
                        oParameters,
                        function (oResponseData) { //Orders response
                            that._debugGlb("Order response reached");

                            var sfcSfcs = oResponseData["sfcs"];
                            resolve(sfcSfcs);
                        }, function (oError, sHttpErrorMessage) {
                            reject(oError);

                        });


                }); //cp
                return oResponseData;
            } catch (error) {
                that._debugGlb("getAllSfcInOrder Error");

            }
        },
        //---------------------- end getStartable SFCS ------

        //
        //Use Promise all to wait until all Promises
        // Have been resolved
        //
        //-- filterStartableSFCs --------------
        // get a list of the startable sfcs as an array 
        // by scanning throught the list fo the passed sfcs (sfctofilter)
        // calling the getSfcStatusIsStartable with every sfc in the list
        // which in turn calls the API /sfc/detail to the get status code of the sfc
        // the returned value is a promise containg all sfcs with status code INQUEW or NEW.

        filterStartableSFCs: async function (sfcstofilter) {
            var startableSFCS = [];
            var promises = sfcstofilter.map(item => {
                return this.getSfcStatusIsStartable(item)
                    .then(isStartable => {
                        if (isStartable) {
                            startableSFCS.push(item);
                        }
                    });
            });
            try {
                await Promise.all(promises);
                return startableSFCS;
            } catch (error) {
                console.log(error); // Log any errors
            }
        },
        //** */
        // planned components API Endpoint (from Asssembly)
        getplannedComponents: async function () {

            var sUrl = this.getPublicApiRestDataSourceUri() + "/assembly/v1/plannedComponents";
            //set the required params we plant and sfc
            var selection = this.getPodSelectionModel().getSelections();
            var thesfc = selection[0].getSfc().getSfc();
            var params = {
                plant: this.getPodController().getUserPlant(),
                sfc: thesfc
            }
            var that = this;
            var oResponseData = await new Promise((resolve, reject) => {

                that.ajaxGetRequest(sUrl, params, function (oResponseData) {

                    //TODO remove this but take some code from it (extraction of
                    //Component and compnent description)
                    //that.ComponentAPISucsess(oResponseData);
                    resolve(oResponseData);

                },
                    function (Error, sHttpErrorMessage) {
                        that.ComponentAPIError(Error, sHttpErrorMessage);
                        reject("Error in tring to planned components");
                    });
            });
            return oResponseData;

        },
        /**vetComponentsToValidate
         * 
         */

        vetComponentsToValidate: async function (componentstovet) {
            var vettedComponets = [];
            var promises = componentstovet.map(item => {
                return this.bGetVettedComponent(item)
                    .then(isVetted => {
                        if (isVetted) {
                            vettedComponets.push(item);
                        }
                    });
            });
            try {
                await Promise.all(promises);
                return vettedComponets;
            } catch (error) {
                console.log(error);
            }
        },

        /**
         * bGetVetttedComponent
         * @param {get} component 
         */
        bGetVettedComponent: async function (component) {
            //getClassification 
            var bVetting = await this.classificationRead(component);
            oLogger.info("classification: " + JSON.stringify(bVetting));

            //fow and until i decipher the classifcatio object
            return true;

        },


        /**
         * 
         *              END DM APIs
         * 
         */
        onTestWorkflow: function (evt) {
            //this.showSuccessMessage("onTestWorkFlow clickd!");
            var eOrder = this.getView().byId("OrderValueLabel").getText();
            this.orchestrateStartAllSfcswrkf(eOrder, evt);



        },
        orchestrateComponentVetting: async function (eOrder, tevt) {
            tevt.getSource().setBusy(true);
            if (!eOrder) {
                this.showErrorMessage("Order Not selected");
                return;
            }
            var theComponents = await this.getplannedComponents();
            //the return value is an array of objects and every object has 3 properties we need to transforn this to an array of values which represent
            // the components which are the first property of the array to be tranformed.

            var transformedComponets = this.traformComponentData(theComponents);
            //now vet the components by getting the classification of the component.
            var vettedComponents = await this.vetComponentsToValidate(transformedComponets);


            tevt.getSource().setBusy(false);


        },


        onStartOrderEnhanced: function (evt) {
            var eOrder = this.getView().byId("OrderValueLabel").getText();

            this.StartOrderEnhanced(eOrder, evt);

        },

        StartOrderEnhanced: async function (eOrder, tevt) {

            if (!eOrder) {
                this.showErrorMessage("Order Not selected");
                return;
            }
            //Get all the sfcs in the order
            var oValidationButton = this.getView().byId("ValidateCompType");
            var allSfcs = await this.getAllSfcsInOrder(eOrder);
            oLogger.info("sfcs found in Order  " + allSfcs.length);

            var oStartOrderButton = this.getView().byId("OrderStartType");
            oStartOrderButton.setBusy(true);

            //start all the sfcs in the order (that are startable)

            var sfcstostart = await this.filterStartableSFCs(allSfcs);

            oLogger.info("startablesfcs size  " + sfcstostart.length);

            // do the validation
            oStartOrderButton.setBusy(false);
            oValidationButton.setBusy(true);

            //get the components
            var theComponents = await this.getComponentsForSfc();
            //vet the components through classification information.
            //var vetted = await this.vettedComponents();

            //set the model for the fragment dialog to validate the components

            var componetsModel = this.ComponentAPISucsess(theComponents);

            var theDialog = await this.openValidateDialog();
            console.log("theDialog="+theDialog);
            oValidationButton.setBusy(false);
            if (theDialog === 1 ){
                
                
                this.showSuccessMessage("Component Validation passsed Process will continue.", true, true);

            }else{
                this.showErrorMessage("Component Validation failed  Process will stop.", true, true);
                
            }
            








            if (0) {
                var vlength = sfcstostart.length;
                //set the parameters for the start outside the loop
                var bAskOnce = false;
                var bComplete = true;
                //var sfcUrl =this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/start?async=false";
                var sfcplant = this.getPodController().getUserPlant();
                var sfcOperation = this._getWorkListSelectedOperationGlb(); //gloabal ch..ch..
                var sfcResource = this.getPodSelectionModel().getResource().getResource();

                for (let i = 0; i < vlength; i += SFCS_CHUNK) {
                    oStartOrderButton.setBusy(true);
                    let startSFCChunk = sfcstostart.slice(i, i + SFCS_CHUNK);

                    var chunckStartd = await this.startAllSfcs(
                        sfcOperation,
                        sfcplant,
                        sfcResource,
                        1,
                        startSFCChunk
                    );

                    oStartOrderButton.setBusy(false);
                    var oCompleteButton = this.getView().byId("CompletComp");

                    //do the complete 
                    oCompleteButton.setBusy(true);
                    var bcompleted = await this.completeOrderSfcs(startSFCChunk);
                    oCompleteButton.setBusy(false);
                    //tevt.getSource().setBusy(false);
                }
            }
        },

        onTestFunction: function (evt) {
            //this.showSuccessMessage("OnTestButton ");
            var eOrder = this.getView().byId("OrderValueLabel").getText();

            this.orchestrateComponentVetting(eOrder, evt);




        },

        orchestrateStartAllSfcswrkf: async function (eOrder, tevt) {
            tevt.getSource().setBusy(true);
            if (!eOrder) {
                this.showErrorMessage("Order Not selected");
                return;
            }
            var allSfcs = await this.getAllSfcsInOrder(eOrder);
            oLogger.info("sfcs found in Order  " + allSfcs.length);

            //TODO split sfcs array into multiple arrays of given size if 
            // if the sfcs in the array are >500
            var sfcstostart = await this.filterStartableSFCs(allSfcs);
            oLogger.info("startablesfcs size  " + sfcstostart.length);


            //temporarilly do signoff so we can test 
            //filter from the list only the active sfcs
            var thesfcs = await this.filterActiveSFCS(allSfcs);
            oLogger.info("active sfcs found  " + thesfcs.length);

            //It does not work because the list contain SFC with status DONE
            oLogger.info("signoff 450 sfcs");
            var partofthesfcs = thesfcs.slice(0, 450);
            var signedoff = await this.signOffSfcs(partofthesfcs);
            partofthesfcs = thesfcs.slice(450, thesfcs.lenght);
            //oLogger.info("signoff sfcs from 450 to the end");
            //var therestof=await this.signOffSfcs(thesfcs);
            tevt.getSource().setBusy(false);


        },

        onSignOffComponents: function (evt) {
            console.log("Validate button pressed");
            var signoffpromise = this.signOffSfcs();
            signoffpromise.then(result => {
                console.log("signoff done");
            }).catch(error => {
                console.log("Error in signoff components:Line 609");
            });
        },

        filterActiveSFCS: async function (thesfcs) {
            var activeSFCS = [];
            var promises = thesfcs.map(item => {
                return this.getSfcStatusIsActive(item)
                    .then(isActive => {
                        if (isActive) {
                            activeSFCS.push(item);
                        }
                    });
            });
            try {
                await Promise.all(promises);
                return activeSFCS;
            } catch (error) {
                console.log("signoff has failed!! line 627"); // Log any errors
            }
        },

        getSfcStatusIsActive: async function (thesfc) {
            try {

                var oResponseData = await this.getSfcStatus(thesfc);
                var code = oResponseData.status.code;
                var sfcsWithCodeStartable = (code == SFCS_ACTIVE) ? oResponseData.sfc : "";
                var goodActive = (code == SFCS_ACTIVE) ? true : false;
                // we want to push this to the model
                // console.log("status code="+code);
                var tm = this.getView().getModel().getProperty("/activeSFCs");
                if (sfcsWithCodeStartable) {
                    tm.push(sfcsWithCodeStartable);
                    this.getView().getModel().setProperty("/activeSFCs", tm);
                    //this._debugGlb("Setting tm in the model after validate called", tm);
                }
                var result = tm;
                return goodActive;

            }
            catch (error) {
                oLogger.infor("Error in the catch of getSfcStatusActive");

            }
        },



        //-------- getStartableSFCS --------------------
        // filter the passed sfcs from the selected order
        // to only sfcs that are appropriate for starting
        // this means only the ones that have status of NEW or InQueue
        // @input sfcstofilter  has all the sfcs in the order
        //----------------------------------------------------------------

        getStartableSFCS: function (plant, sfcstofilter) {
            //for each sfc get the status (getSFCStatusIsStartable DM API call)
            var that = this;

            sfcstofilter.forEach((item, index) => {
                var promiseReturned = this.getSfcStatusIsStartable(item);
                promiseReturned.then(result => {
                    console.log("then=" + result);
                    //that._glbstartableSFCObj._glbSet(result);
                    //that.getView().getModel().setProperty("/startableSFCs",result);
                    //var  currentState=that.getView().getModel().getProperty("/startableSFCs");

                });
            });
            // At this point the list of startable sfcs should be in the model ("startableSFCs")
            // check by putting a watch variable sfcGoodtoStart
            var sfcsGoodtostart = this.getView().getModel().getProperty("/startableSFCs");
            //this._debugGlb("after loop state of Model.startableSFCs" + sfcsGoodtostart);
        },

        //---------------- End getStartable SFCs -------------------------


        traformComponentData: function (oResponseData) {
            var result = oResponseData;
            var justthecomponentArr = [];
            for (let i = 0; i < result.length; i++) {

                justthecomponentArr.push(result[i].component);
            }
            this.getView().getModel().setProperty("/justcomponentslist", justthecomponentArr);
            return justthecomponentArr;
        },


        /**
         * 
         * @param {*} oResponseData ther Response from the 
         *                      "/assembly/v1/plannedComponents"
         * @returns componentModel --also sets the table model /components
         * 
         */

        ComponentAPISucsess: function (oResponseData) {
            var result = oResponseData;
            var componentmodel = {
                components: []
            };
            for (let i = 0; i < result.length; i++) {

                componentmodel.components.push(
                    { component: result[i].component, description: result[i].componentDescription, validated: "N" }
                );

            }
            this.getView().getModel().setProperty("/components", componentmodel.components);
            return componentmodel;
        },
        ComponentAPIError: function (oError, sHttpErrorMessage) {
            //TODO do something with the error condition
        },

        startAllSfcsWorkflow: async function (order) {
            oLogger.info("start all sfcsworkflow clicked");
        },


        // [Validate component IS]
        //------------------ Start Validate Components --------

        onValidateComponents: function (evt) {
            if (evt) {
                oLogger.info("onValidateComponents: " + evt);
            } else {
                oLogger.info("onValidateComponents -called internally");

            }

            var fakemodel = {
                components: [
                    { component: "Component1", description: "Description1", validated: "Y" },
                    { component: "Component2", description: "Description2", validated: "N" },
                    { component: "Component3", description: "Description3", validated: "Y" }
                ]
            };
            this.getView().getModel().setProperty("/components", fakemodel.components);
            //component API Endpoint (from Asssembly)
            var sUrl = this.getPublicApiRestDataSourceUri() + "/assembly/v1/plannedComponents";
            //set the required params we plant and sfc
            var selection = this.getPodSelectionModel().getSelections();
            var thesfc = selection[0].getSfc().getSfc();
            var params = {
                plant: this.getPodController().getUserPlant(),
                sfc: thesfc
            }
            var that = this;
            this.ajaxGetRequest(sUrl, params, function (oResponseData) {
                that.ComponentAPISucsess(oResponseData);
            }, function (Error, sHttpErrorMessage) {
                that.ComponentAPIError(Error, sHttpErrorMessage);
            });

            //TODO handle failures gracefully
            //illumiti.ext.viewplugins.exampleViewPlugin.view.ComponentValidation"
            //^ -------- app ----------------------------^--view+^ fragment without fragment.xml
            // Assumes that fragment is in the same folder as the plugin view

            if (!this._oDialog) {
                this.loadFragment({
                    name: "illumiti.ext.viewplugins.exampleViewPlugin.view.ComponentValidation"
                }).then(function (oDialog) {
                    this._oDialog = oDialog;
                    this.getView().addDependent(this._oDialog);
                    this._oDialog.open();
                }.bind(this));
            } else {
                this._oDialog.open();
            } //--
        },

        onValidateComponent: function () {
            var oTable = this.byId("Vcomp");
            var oInput = this.byId("componentInput");
            var sValue = oInput.getValue();
            var aItems = oTable.getItems();
            var bFound = false;

            for (var i = 0; i < aItems.length; i++) {
                var oItem = aItems[i];
                var oCells = oItem.getCells();

                if (oCells[0].getText() === sValue) {
                    bFound = true;
                    oCells[2].setText("Y");
                    oItem.addStyleClass("markFound"); // Add a CSS class to change the color of the row
                    break;
                }
            }

            if (!bFound) {

                //this.showErrorMessage("Componente Not found -- Validation failed");
                this._oDialog.close();
                this._oResolve(0); // Resolve the Promise with 0
            } else {
                var bAllChecked = aItems.every(function (oItem) {
                    return oItem.getCells()[2].getText() === "Y";
                });

                if (bAllChecked) {
                    this._oDialog.close();
                    this._oResolve(1); // Resolve the Promise with 1
                }
            }
        },

        openValidateDialog: async function () {
            return new Promise((resolve, reject) => {
                this._oResolve = resolve;
                if (!this._oDialog) {
                    this.loadFragment({
                        name: "illumiti.ext.viewplugins.exampleViewPlugin.view.ComponentValidation",
                        controller: this
                    }).then(function (oDialog) {
                        this._oDialog = oDialog;
                        this.getView().addDependent(this._oDialog);
                        this._oDialog.attachAfterClose(null, function (oEvent) {
                            if (/*oEvent.getParameter("origin") === sap.ui.core.CloseCallOrigin.Escape*/ false) {
                                resolve(-1); // Resolve the Promise with -1 if the dialog was closed with the Escape key
                            } else {
                                resolve("result"); // Resolve the Promise with the stored value otherwise
                            }
                        }, this);
                        this._oDialog.open();
                    }.bind(this)).catch(function (oError) {
                        reject(oError); // Reject the Promise if there's an error
                    });
                } else {
                    this._oDialog.open();
                }
            });
        },

        //----------------- End Validate Components ----------
        onValidatePressedx: function (evt) {
            var howManyMatched = 0;
            this.showSuccessMessage("Validate button pressed");
            var scannedOrEntered = this.byId("componentInput").getValue();
            var oTable = this.byId("Vcomp");
            var nRows = oTable.getItems();
            if (scannedOrEntered) {
                for (var i = 0; i <= nRows.lenth; i++) {

                    var cellValue = nRows[i].getCells().getText();
                    if (cellValue === scannedOrEntered) {
                        console.log("cell value =" + cellValue + " to matech :" + scannedOrEntered);
                        nRows[i].addStyleClass("markFound");
                        nRows[i].getCells[2].setText["Y"];
                        howManyMatched++;

                    } else {
                        this.showErrorMessage("Validation failed click ok to abort");

                        this.byId("dcomponentValidator").close();
                        return "vfail";

                    }
                }

                if (howManyMatched === nRows.length) {
                    // Close the dialog and return a success indication
                    this.byId("Vcomp").close();
                    return "Success";
                } else if (0) { // Replace this with your condition to check if the user aborts
                    // Close the dialog and return an abort value
                    this.byId("dcomponentValidator").close();
                    return "Abort";
                }


            } else {

            }
        },

        onCompleteComponents: function (evt) {

            this.showSuccessMessage("Validate button pressed");

        },
        onSignOffComponents: function (evt) {
            this.showSuccessMessage("Validate button pressed");

        },
        stateMachineLutronProcess: function (state) {


            var currentLPState = state ? state : LPNS;

            //get all the button id's from the view

            var ButtonSO = this.byId("OrderStartType");
            var ButtonVC = this.byId("ValidateCompType");
            var ButtonCO = this.byId("CompletComp");
            var ButtonSOFF = this.byId("SignoffComp");
            var buttonSoText = ButtonSO.getText();
            var ButtonVcText = ButtonVC.getText();
            var ButtonCoText = ButtonCO.getText();

            switch (state) {
                case INIT_LP:
                    //all buttons are disabled
                    ButtonSO.setEnabled(false);
                    ButtonVC.setEnabled(false);
                    ButtonCO.setEnabled(false);
                    ButtonSOFF.setEnabled(false);
                    currentLPState = INIT_LP;
                    break;

                case START_ORDER_ON:
                    ButtonSO.setEnabled(true);
                    currentLPState = START_ORDER_ON;
                    break;

                case START_ORDER_WORKING:
                    ButtonSO.setEnabled(false);
                    ButtonSO.setText("Working ......");
                    currentLPState = START_ORDER_WORKING;
                    break;
                case START_ORDER_DONE:
                    ButtonSO.setEnabled(true);
                    ButtonSO.setText("Start Order");
                    currentLPState = START_ORDER_DONE;
                    //ButtonVC.setText("Validate Component working ...");
                    ButtonVC.setEnabled(true);



                    break;
                case VALIDATE_COMP_ON:
                    break;
                case VALIDATE_COMP_DONE:
                    break;
                case COMPLETE_ORDER_ON:
                    break;
                case COMPLETE_ORDER_WORKING:
                    break;
                case COMPLETE_ORDER_DONE:
                    break;

                default:
                    console.log("Unknown state");


                    return currentLPState;

            }
        },






        //[Order IS]
        //----- Lutron Start Order ----------------
        // The StartOrder button was pressed
        // We need to start all the sfc's in the order
        // first call Order API to get all the SFCS for the order
        // filter the sfc only the ones appropriate for starting (remove sfc's that are Active)
        // then call start/sfcs to start all the gathered SFCS
        // 
        //
        // TODO Generalize for use in other plugins.
        // -----------------------------------------

        onStartOrder: function (evt) {
            var oButtonSO = evt.getSource();
            this._debugGlb("onStartOrder ");
            //check to see if a selection have been made
            var oOp = this._getWorkListSelectedOperationGlb();
            if (oOp === "notset") {
                this.showErrorMessage("Order is not selected", true);
                return;
            } else {
                //set the Busy indicator to the startOrders Button.

                oButtonSO.setBusy(true);
                this.stateMachineLutronProcess(START_ORDER_WORKING);
            }

            //get the Order from the label box 
            //var eOrder=this.getView().byId("OrderTypeInput").getValue();
            var eOrderLabel = this.getView().byId("OrderValueLabel").getText();
            //get the plant
            var ePlant = this.getPodController().getUserPlant();

            //for the URL for geting the order 
            //Need generalization so we dont have to form the URL everytime

            //--- start call sequence - Order -sfc ------------------
            var sUrl = this.getPublicApiRestDataSourceUri() + "/order/v1/orders";
            oLogger.info("sUrl : " + sUrl);
            //Set the parameters
            var oParameters = {
                order: eOrderLabel,
                plant: ePlant
            };
            var that = this;

            //---------------------------- ajaxGetRequest /Orders ------------------
            //get all the sfc in the order calling the order API and extracting sfcs from the response
            this.ajaxGetRequest(
                sUrl,
                oParameters,
                function (oResponseData) { //Orders response
                    that._debugGlb("Order response reached");

                    var sfcUrl = that.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/start?async=false";
                    var sfcplant = that.getPodController().getUserPlant();
                    var sfcOperation = that._getWorkListSelectedOperationGlb(); //gloabal ch..ch..
                    var sfcResource = that.getPodSelectionModel().getResource().getResource();
                    var sfcSfcs = oResponseData["sfcs"];

                    // check getStartableSFCS and get in the list (filteredsfcs) only the ones that can be started.

                    console.log("all order sfcs count = " + sfcSfcs.length);
                    var filteredsfcs = {};
                    if (!ENABLE_PROMISE_ALL) {
                        filteredsfcs = that.getStartableSFCS(sfcplant, sfcSfcs);
                    } else {
                        //filteredsfcs is a promise 
                        filteredsfcs = that.filterStartableSFCs(sfcSfcs);
                    }



                    // validatedfcs contains the filtered sfcs (new,inqueue)
                    // below in the ssfcParameters.sfcs
                    let totalSfcProcecesed = 0;

                    //--- TOP level then chain ---------------------
                    filteredsfcs.then(validatedsfcs => {
                        console.log(validatedsfcs);
                        let vlength = validatedsfcs.length;
                        if (vlength == 0) {
                            that.showErrorMessage("Nothing to Start");
                            return;


                        }
                        console.log("validated sfcs lentgh" + vlength);

                        // Split the sfc list of validated sfcs
                        // to chuncks of CFCS_CHUNK
                        // and call start with one chunk of SFCs at a time.

                        for (let i = 0; i < vlength; i += SFCS_CHUNK) {
                            let startSFCChunk = validatedsfcs.slice(i, i + SFCS_CHUNK);
                            //we have a bunch of startable sfcs here in 

                            console.log("chunck = " + startSFCChunk.length);
                            var ssfcParameters = {
                                plant: sfcplant,
                                operation: sfcOperation,
                                quantity: 1, //TODO find the quantity 
                                resource: sfcResource,
                                sfcs: startSFCChunk //,
                                // processLot:""
                            }
                            that._debugGlb("onStartOrder: before PostRequest ");
                            //--------------------ajaxPostRequest /sfc/v1/sfcs ------------
                            if (EXECUTE_CODE) { //remove line
                                that.ajaxPostRequest(
                                    sfcUrl,
                                    ssfcParameters,
                                    function (oResponseData) {
                                        that.showSuccessMessage("Order Started succesfully!", true);
                                        //oLogger.info("Orderstart success");
                                        that.stateMachineLutronProcess(START_ORDER_DONE);

                                    },
                                    //The error call back for the /sfc/sfcs/start API call
                                    function (oError, sHttpErrorMessage) {
                                        oLogger.info("Errors - sfc start  " + sHttpErrorMessage);
                                        that.showErrorMessage(oError, true);
                                    }
                                );   //close parenthesis for the Post call (sfs/sfcs/start)
                            } // remove 
                            else { // -- remove line 
                                //debug section will not run when EXECUTE_CODE ==TRUE
                                console.log("-- ajaPostRequest bypassed");
                                console.log("to start=" + startSFCChunk.length);
                                //validate components here and subsequently complete

                                var clresult = that.classificationRead();
                                //--------------  second level Then chain --------------------------
                                clresult.then(cl => {
                                    console.log(cl);
                                    var vc = that.onValidateComponents();
                                    //chain here the complete
                                    var compresult = that.completeOrderSfcs();
                                    compresult.then(compsfcs => {
                                        console.log(compsfcs)

                                    });


                                });
                                // ----- end second level then chain 


                            } // -- remove 
                        }
                    }
                        //Inside then
                    );
                    // ------  End top level then chain 
                },//--- End Response from start Order block
                //the error callback for the /Order API call
                function (oError, sHttpErrorMessage) {
                    oLogger.info("Errors " + sHttpErrorMessage);
                });
            // Hide theBusy operator       
            oButtonSO.setBusy(false);

            // This might have side effect
            // so comment out for now.
            this.loadModel();
        },
        //----  End Lutron Start Order ---------

        // ---------------Error - sucess callbacks -----
        SucessPostSfcs: function (oResponseData) {

        },
        ErrorPostSfcs: function (oError, sHttpErrorMessage) {

        },
        SucessGetOrder: function (oResponseData) {

        },
        ErrorGetOrder: function (oError, sHttpErrorMessage) {

        },
        //------------End Error Sucess callbacks

        //--------------------------------------
        // //[LoadModel IS]
        // loadModel
        // The loadModel aggregates all the current information from the POD and 
        // set this model as the view model
        //-------------------------------------------

        loadModel: function () {
            //get the view in oView
            var oView = this.getView();
            var oPodController = this.getPodController();
            //get configuration as set in the POD designer 
            var oConfiguration = this.getConfiguration();
            oLogger.info("config: " + JSON.stringify(oConfiguration));
            var bNotificationsEnabled = true;
            // if notification is enabled
            if (oConfiguration && typeof oConfiguration.notificationsEnabled !== "undefined") {
                bNotificationsEnabled = oConfiguration.notificationsEnabled;
            }
            //get the podSelectionModel in oPodSelectionModel
            var oPodSelectionModel = this.getPodSelectionModel();
            if (!oPodSelectionModel) {
                oView.setModel(new JSONModel());
                this._debugGlb("INFO: loadModel - 1091 Model globbered no selectionModel");
                return;
            }
            //get the pod type in sPodType
            var sPodType = oPodSelectionModel.getPodType();
            var sResource;
            //get the Resource in sResource
            var oResourceData = oPodSelectionModel.getResource();
            if (oResourceData) {
                sResource = oResourceData.getResource();
            }
            var iSelectionCount = 0;
            var aInputs = [];
            var sInput, sSfc, sMaterial, sShopOrder;
            //get the selections in aSelections
            var aSelections = oPodSelectionModel.getSelections();
            if (aSelections && aSelections.length > 0) {
                //loop through all the selections and extract info in sInput ,sSfc , sMaterial,sShopOrder
                for (var i = 0; i < aSelections.length; i++) {
                    sInput = aSelections[i].getInput();
                    if (sInput && sInput !== "") {
                        sSfc = "";
                        if (aSelections[i].getSfc()) {
                            sSfc = aSelections[i].getSfc().getSfc();
                        }
                        sMaterial = "";
                        if (aSelections[i].getItem()) {
                            sMaterial = aSelections[i].getItem().getItem();
                        }
                        sShopOrder = "";
                        if (aSelections[i].getShopOrder()) {
                            sShopOrder = aSelections[i].getShopOrder().getShopOrder();

                            // Store shop order in selectedOrder will be used in Model and the View
                            //Only store the first order selected , ignore the others in multiselection
                            //Situation.
                        }

                        aInputs[aInputs.length] = {
                            input: sInput,
                            sfc: sSfc,
                            material: sMaterial,
                            shopOrder: sShopOrder
                        };
                    }
                }
                iSelectionCount = aInputs.length;
            }


            var iOperationCount = 0;
            var aOperations = [];
            var aMaterialCustomFields = [];
            var sOperation;
            var oOperations = oPodSelectionModel.getOperations();
            //get all the operation this will not get anything in the Worklist page
            if (oOperations && oOperations.length > 0) {
                for (var i = 0; i < oOperations.length; i++) {
                    sOperation = oOperations[i].operation;
                    if (sOperation) {
                        aOperations[aOperations.length] = {
                            operation: sOperation,
                            version: oOperations[i].version
                        };
                    }
                }
                iOperationCount = aOperations.length;
            } else {

            }
            // Create the Model in oModelData
            var oInputType = oPodSelectionModel.getInputType();
            var oWorkCenter = oPodSelectionModel.getWorkCenter();
            //operation  somehow is not in the selection Model so we will 
            // Use the one that we stored from the WorklistChangeEvent
            var oOperation = this._getWorkListSelectedOperationGlb();
            if (oOperation === "notset") {
                oOperation = "";
            }

            var oModelData = {
                podType: sPodType,
                inputType: oInputType,
                workCenter: oWorkCenter,
                operation: oOperation,
                resource: sResource,
                selectionCount: iSelectionCount,
                operationCount: iOperationCount,
                selections: aInputs,
                orderselect: sShopOrder,
                operations: aOperations,
                notificationsEnabled: bNotificationsEnabled,
                notificationMessage: "",
                //Not needed for lutron but i leave it in.
                materialCustomFields: aMaterialCustomFields,
                wrklstrow: wrklstcurrentsel,
                material: "",
                startableSFCs: [],
                activeSFCs: [],
                components: []
            };

            if (aOperations.length === 1) {
                oModelData.operation = aOperations[0].operation;
            }
            // add material custom fields to model
            //this.addMaterialCustomFields(oPodController.getUserPlant(), sMaterial);

            var oModel = new JSONModel(oModelData);
            //this._debugGlb("Model is re-intialized with :" + (oModelData.startableSFCs), oModelData.operation);

            // Set the model for the View with the gathered info
            // if we have aInputs we want to set in the model the first material 
            // for the Lutron plugin
            oModelData.material = aInputs.length ? aInputs[0].material : "";

            oView.setModel(oModel);
        },

        /*--------------------------------------------------------
         * This enables receiving Notification messages in the plugina
         * @override
         */
        isSubscribingToNotifications: function () {
            var oConfiguration = this.getConfiguration();
            var bNotificationsEnabled = true;
            if (oConfiguration && typeof oConfiguration.notificationsEnabled !== "undefined") {
                bNotificationsEnabled = oConfiguration.notificationsEnabled;
            }
            return bNotificationsEnabled;
        },

        /*----------------------------
         * Return the event name (i.e.;MEASUREMENT) being subscribed to by this plugin
         * @override
         */
        getCustomNotificationEvents: function () {
            return ["MEASUREMENT"];
        },

        /*
         * Return the function to be called when a MEASUREMENT notification message is received
         * @override
         */
        getNotificationMessageHandler: function (sTopic) {
            if (sTopic === "MEASUREMENT") {
                return this.handleNotificationMessage;
            }
            return null;
        },

        handleNotificationMessage: function (oMsg) {
            //oLogger.info("handleNotificationMessage oMsg:" + oMsg);
            var sMessage = "Message not found in payload 'message' property";
            if (oMsg && oMsg.parameters && oMsg.parameters.length > 0) {
                for (var i = 0; i < oMsg.parameters.length; i++) {
                    if (oMsg.parameters[i].name === "message") {
                        sMessage = oMsg.parameters[i].value;
                        break;
                    }
                }
            }
            this.getView().getModel().setProperty("/notificationMessage", sMessage);
        },
        //TODO remove this API call for the Lutron Plugin
        // Commented out in the caller
        addMaterialCustomFields: function (sPlant, sMaterial) {
            // Populate parameters with plant and material name 
            var oParameters = {
                plant: sPlant,
                material: sMaterial
            };
            //TODO generalize this to be reusubale for the HTTP get (generize overall)
            var sUrl = this.getPublicApiRestDataSourceUri() + "/material/v1/materials";
            // Ajax GET request to read Material custom fields by using Public API 
            this.executeAjaxGetRequest(sUrl, oParameters);
        },

        executeAjaxGetRequest: function (sUrl, oParameters) {
            var that = this;
            this.ajaxGetRequest(sUrl, oParameters,
                function (oResponseData) {
                    that.handleResponse(oResponseData);
                },
                function (oError, sHttpErrorMessage) {
                    that.handleError(oError, sHttpErrorMessage);
                }
            );
        },

        handleResponse: function (oResponseData) {
            if (oResponseData && oResponseData.length > 0) {
                // set customValues data to model property "materialCustomFields"     
                this.getView().getModel().setProperty("/materialCustomFields", oResponseData[0].customValues);
            }
        },

        handleError: function (oError, sHttpErrorMessage) {
            var err = oError || sHttpErrorMessage;
            // show error in message toast   
            this.showErrorMessage(err, true, true);
        },

        configureNavigationButtons: function (oConfiguration) {

            if (!this.isPopup() && !this.isDefaultPlugin()) {
                console.log("configureNavigationButtons in the if");
                this.byId("closeButton").setVisible(oConfiguration.closeButtonVisible);
                console.log("configureNavigationButtons outside the if");
            }
        }
    });
    return oPluginViewController;
});


