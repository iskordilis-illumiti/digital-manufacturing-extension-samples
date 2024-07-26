// Start all sfc's in an Order , validate components, complete all Sfcs : customer-> Lutron
sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/base/Log"
], function (JSONModel, Fragment, MessageBox, PluginViewController, Log) {
    "use strict";
    //TODO Break this into multiple modules with well defined dependencies
    // Then import into this main module for the plugin


    var oLogger = Log.getLogger("View Plugin", Log.Level.INFO);
    //------------------------------------------------------------------------

    //  add a wrklstcurrentsel to receive the selected row on the worklist 
    // (this is includes Operation that is missing from the selectionModel for some reason)
    //  this will be global var in this POD context
    // this object is updated everytime that the selection on the worklist is changed
    // the loadModel  is updated to merge this object into the model in the view
    //TODO create a closure function with getters and setters to remove this from
    // The global space. Use the onInit to initialize.
    // in the loadModel use the getters and setters to populate the Object that will 
    // become the object. Alternatively use this to create and object with this variables in the controller.


    //current selection might contain more than 1 selection
    var wrklstcurrentsel = {};

    //current operation last selected
    var wrklstsopersel = "notset";

    //not used even though is in the model
    //needs to be removed.
    var uniqueCSel = {};

    //unique single last selection from the user    
    //this needs special consideration when user de-selects
    var wrklistuniquesel = {};

    //keeps track of the current size to 
    //detect deselections by comparing to the new size
    var wrkselsize = 0;

    var glbStack = [];
    var _glbstartableSFCObj = {
        _sfcGoodToStart: [],
        _glbGetsfcGoodToStart: function () { return this._sfcGoodToStart },
        _glbAdd: function (sObj) { this._sfcGoodToStart.push(sObj) },
        _glbErase: function () { this._sfcGoodToStart = [] },
        _glbSet: function (sobj) { this._sfcGoodToStart = sobj },
    };


    const COMPONENT_VALIDATION_SUCCESS = 1;


    // start with 50 increase inrementally after tests to test stability.
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
    const VSTORE_LIMIT = 50;

    //--------------------------------------------------------------------------

    var oPluginViewController = PluginViewController.extend("illumiti.ext.viewplugins.exampleViewPlugin.controller.PluginView", {
        metadata: {
            properties: {
            }
        },

        onInit: function () {
            //marker4
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

            var oValidationButton = this.getView().byId("ValidateCompType");
            var oStartOrderButton = this.getView().byId("OrderStartType");
            var oCompleteButton = this.getView().byId("CompletComp");
            var oSignoffButton = this.getView().byId("SignoffComp");
            var oMessageArea = this.getView().byId("MessageAreaId");

            oLogger.info("onInit config is:" + oConfig);



            // check if close icon should be displayed
            //Configured in the POD Designer 
            //this.configureNavigationButtons(oConfig);
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

        },

        onAfterRendering: function () {

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

        /**
         * onWorkListSelectEvent
         * When Worklist selection event fires , get all the info needed by the plugin
         * alling the this.loadModel() function
         * We need to extract the operation from the oData
         * @param {*} sChannelId 
         * @param {*} sEventId 
         * @param {*} oData 
         * @returns 
         */
        onWorkListSelectEvent: function (sChannelId, sEventId, oData) {
            //get the data from the worklist selection row into wklstcurrentsel
            //get the operation into wrklstsopersel
            if ((typeof oData === 'undefined') || oData.selections.length === 0) {
                wrklstcurrentsel = {};
                wrklstsopersel = "notset";
                wrklistuniquesel = {};
                wrkselsize = 0;


            }
            else {
                let iOpLen = oData.selections.length;
                if (iOpLen < wrkselsize) {
                    //we are removing selections
                    //we have to have a new order displayed from the last selection from the ones left
                }
                //get the current selections if any
                let curSel = this.getView().getModel().getProperty("/wrklstrows");
                oLogger.info(`The current selection is ${curSel}`);

                //The new set of selections
                //any selection in wrklstcurrentsel not included in the curSel is the single current selection
                // When we have multiseletions.          
                wrklstsopersel = oData.selections[iOpLen - 1] ? oData.selections[iOpLen - 1].operation : "notset";
                wrklstcurrentsel = oData;
                wrkselsize = oData.selections.length;
                if (Object.keys(curSel).length !== 0) {
                    // compare the selections at hand with the new selections from the event
                    // the new exra selection becomes the current unique selection.
                    // put this into the model since it includes a lot of other information in addition to
                    // sfc - like  order , material , operation and others.

                    //this will not work when user de-selects

                    let uniqueSel = wrklstcurrentsel.selections.filter(wrkSel => !curSel.selections.some(curSel => curSel.sfc === wrkSel.sfc));
                    oLogger.info(`the current selection is ${JSON.stringify(uniqueSel)}`);
                    if (Object.keys(uniqueSel).length == 0 || iOpLen < wrkselsize) {
                        uniqueSel = wrklstcurrentsel[iOpLen - 1];

                    }
                    this.getView().getModel().setProperty("/uniqueSel", uniqueSel);

                    wrklistuniquesel = uniqueSel;

                    //Marker 501
                }
                else {
                    curSel = wrklstcurrentsel;
                }
            }
            oLogger.info(`onWorklistSelectEvent  ${wrklstsopersel}`);
            // don't process if same object firing event
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            this.loadModel();
            this.getView().getModel().setProperty("/uniqueSel", wrklistuniquesel);

            if (Object.keys(wrklistuniquesel).length !== 0) {
                this.getView().getModel().setProperty("/orderselect", wrklistuniquesel[0].shopOrder);
            }
        },

        _getWorkListSelectedOperationGlb: function () {
            return wrklstsopersel;
        },
        _getWorkListSelectedRowDataGlb: function () {
            return wrklstcurrentsel;
        },

        _debugGlb: function (m, b) {

            try {
                var param = b ? b : "";
                var param0 = m ? m : "info:";
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

        /**
         * delay()
         * 
         * @param {*} ms  number of miliseconds to delay
         * @returns 
         */
        delay: function (ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * bCheckUndefined
         * check if an object is undefined
         * 
         * @param {} obj 
         * @returns 
         */
        bCheckUndefined: function (obj) {
            return (typeof obj === 'undefined');
        },



        /****************************************************************
         * 
         *                  APIs DM and Derivatives
         *                  These are in the context of the POD and POD selection Model
         * 
         *
         *****************************************************************/


        /**
         * Call a PPD from the custom plugin 
         * In Development ...
         * Marker113
         * 
         */

        callAPPD: async function (params,nopr) {
            var sfcplant = this.getPodController().getUserPlant();
            var iOperation = this.getView().getModel().getProperty("/operation");
            var iResource = this.getView().getModel().getProperty("/resource");
            var iOrder = this.getView().getModel().getProperty("/orderselect");
            var altWc = this.getView().getModel().getProperty("/workCenter");


            var selection = this.getPodSelectionModel().getSelections();
            var thesfc = selection[0].getSfc().getSfc();
            var iRouting = selection[0].sfcData.routing;
            var rType = "SHOPORDER_SPECIFIC"; //selection[0].sfcData.routingType;
            var rVersion = selection[0].sfcData.routingVersion;
            var workC = selection[0].sfcData.workCenter;
            var oStepId = selection[0].sfcData.stepId;
            var iUserId = this.getPodController().getUserId();

            var ppdconfig = this.getConfiguration();

            var sUrl = this.getPublicApiRestDataSourceUri() + "/pe/api/v1/process/processDefinitions/start?key=REG_96676307-ea1f-4fda-9936-035625c5e1d1&async=false";
            ///pe/api/v1/process/processDefinitions/start?key=REG_96676307-ea1f-4fda-9936-035625c5e1d1
            ///pe/api/v1/process/processDefinitions/start?key=REG_96676307-ea1f-4fda-9936-035625c5e1d1

            var iparams = {
                "inOperation": iOperation,
                "inPlant": sfcplant,
                "inResource": iResource,
                "inRouting": iRouting,
                "inRoutingType": "SHOPORDER_SPECIFIC",
                "inNumberOfOperators": 3,
                "inRoutingVersion": rVersion,
                "inSfc": thesfc,
                "inOrder": iOrder,
                //"inStartTime":"",
                "inStepId": oStepId,
                "inWorkCenter": workC,
                "inUserId": iUserId,
                "inOperationVersion": "ERP001"

            }
            try {

                var ppdresult = new Promise((resolve, reject) =>{
                    this.ajaxPostRequest(
                        sUrl,
                        params,
                        function (ppdresult) {
                            resolve(ppdresult);
                        },
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("call PPD Failed" + sHttpErrorMessage);
                            reject(oError);
                        });
                });
                return ppdresult;
            } catch (oError) {
                this.showErrorMessage("Call to PPD laborOn failed");
                throw oError;
            }
        },

        /**
         *  return laborOnPPDParams;
         * Marker222
         * @param {*} thesfc the sfctofind all the details to create params for LaborOn PPD
         */
        getSFCDetailsForLaborOnPPD: async function (thesfc,iOrder) {
            var sfcplant = this.getPodController().getUserPlant();
            var userId=this.getPodController().getUserId();
             var worklistData = await this.getWorklistDataSelectedOrder(iOrder);

             var orderSfcs = worklistData[0].orderSfcs;

             var sfcfound = orderSfcs.find( sfc => sfc.sfc == thesfc);
             if (sfcfound){
             var thesteps = sfcfound.steps;
             var thefirststep=thesteps[0];

             }
             else {
                this.showErrorMessage("Sfc not found ");

             }

             

             var laborOnPPDParams = {
                "inOperation": thefirststep.operation.operation,
                "inPlant": sfcplant,
                "inResource": thefirststep.resource,
                "inRouting": thefirststep.stepRouting.routing,
                "inRoutingType": thefirststep.stepRouting.type,
                "inNumberOfOperators": 3,
                "inRoutingVersion": thefirststep.stepRouting.version,
                "inSfc": thesfc,
                "inOrder": iOrder,
                //"inStartTime":"",
                "inStepId": thefirststep.stepId,
                "inWorkCenter": thefirststep.plannedWorkCenter,
                "inUserId": userId,
                "inOperationVersion": thefirststep.operation.version
            

               
             }
             return laborOnPPDParams;          

        },


        /**
         * prtLoadingValidation
         * Assumes a current Selection Model 
         * @param {*} psfcs 
         * @returns 
         */
        prtLoadingValidation: async function (psfcs) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/tool/v1/prtLoadValidation";
            var sfcplant = this.getPodController().getUserPlant();
            var sfcOperation = this._getWorkListSelectedOperationGlb();
            var selection = this.getPodSelectionModel().getSelections();


            var sfcResource = this.getView().getModel().getProperty("/resource");
            //Any sfc will do for the prtLoadingValidation ?
            var thesfc = selection[0].getSfc().getSfc();
            var xpsfcs = [];
            xpsfcs.push(thesfc);

            var ssfcParameters = {
                plant: sfcplant,
                sfcs: xpsfcs,// psfcs
                operation: sfcOperation,
                resource: sfcResource,
            };
            var that = this;

            var oResponseData = await new Promise((resolve, reject) => {
                this.ajaxPostRequest(
                    sUrl,
                    ssfcParameters,
                    function (oResponseData) {

                        resolve(oResponseData);
                    },
                    function (oError, sHttpErrorMessage) {
                        oLogger.info("prtLoadingValidation API call failed " + sHttpErrorMessage);

                        //if (oError){
                        //that.showErrorMessage(oError, true);
                        //} else {
                        //     that.showErrorMessage(sHttpErrorMessage, true);
                        //  }
                        reject(oError);
                    });
            });
            return oResponseData;

        },

        /**
         *  bCheckSelectionModel
         * @returns true or false depending if we have 
         *          a selection model
         */
        bCheckSelectionModel: function () {
            var selection = this.getPodSelectionModel().getSelections();
            if (selection.length === 0) {
                return false;
            } else {
                var thesfc = selection[0].getSfc().getSfc();
                return true;
            }
        },

        /**
         * SignOFSfcs
         * @param {*} psfcs 
         * @returns 
         */
        signOffSfcs: async function (psfcs) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/signoff?async=false";
            var sfcplant = this.getPodController().getUserPlant();
            var sfcOperation = this._getWorkListSelectedOperationGlb();
            var sfcResource = this.getPodSelectionModel().getResource().getResource();

            var oView = this.getView();
            var oModel = oView.getModel();
            var oOrder = oModel.getProperty('/orderselect');
            //theOrder=this.getView().getModel().getProperty('/orderselect');
            //console.log(`order: ${oOrder}`);        
            var ssfcParameters = {
                plant: sfcplant,
                operation: sfcOperation,
                resource: sfcResource,
                sfcs: psfcs
                //sfcs: null,
                //processLot: null
                // dateTime:""
            };
            var that = this;
            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            //that.showSuccessMessage("Signoff done", true);
                            oLogger.info("signoff success");
                            resolve(oResponseData);
                        },
                        //The error call back for the /classification/v1/read
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("Signoff   API call failed " + sHttpErrorMessage);
                            if ((typeof oError === 'undefined')) {
                                that.showErrorMessage(sHttpErrorMessage, true);
                            }
                            else {
                                that.showErrorMessage(oError, true);
                            }
                            reject(oError);
                        });
                });
                return oResponseData;
            } catch (error) {
                this.showErrorMessage("An error was detected: in signOffSfcs ", true);
                this.resetButtonsWrkfl();
                //added check to see if it impedes to signoff button to restore to normal.
                throw error;
            }
        },

        /**
         * getWorklistDataSelectedOrderCount
         * 
         * @returns Count of worklist items
         */
        getWorklistDataSelectedOrderCount: async function () {
            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/worklist/orders";
                    var selection = this.getPodSelectionModel().getSelections();
                    var thesfc = selection[0].getSfc().getSfc();
                    var thePlant = this.getPodController().getUserPlant();
                    var theOperation = this._getWorkListSelectedOperationGlb();
                    var sfcResource = this.getPodSelectionModel().getResource().getResource();

                    var thisfilter = {
                        operation: theOperation,
                        resource: sfcResource

                    };
                    var params = {
                        plant: thePlant,
                        order: thisfilter.order
                        
                    };

                    this.ajaxGetRequest(sUrl, params, function (oResponseData) {
                        resolve(oResponseData);
                    }, function (Error) {
                        reject(Error);
                    });
                });
                return oResponseData;
            } catch (error) {
                this.showErrorMessage("sfc/v1/worklist/orders failed", true);
                this.resetButtonsWrkfl();

            }

        },

        OpenConfirmationDialog: async function (prompt) {
            // Wrap the MessageBox in a Promise
            const userDecision = await new Promise((resolve) => {
                MessageBox.confirm(prompt, {
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: function (oAction) {
                        // Resolve the promise based on the user's action
                        const decision = oAction === MessageBox.Action.YES;
                        resolve(decision);
                    }
                });
            });

            // Use the user's decision
            if (userDecision) {
                // User chose "Yes"
                console.log("User chose Yes");
                // Further execution path for "Yes"
            } else {
                // User chose "No"
                console.log("User chose No");
                // Further execution path for "No"
            }

            return userDecision;
        },


        /**
         * getWorklistDataSelectedOrder
         * 
         * it will return an orray of objects  for the given operation ,  and plant
         * the Additional information is in the returned object , like sfc status , material, bom and other
         * this is pageable call so  you have to call the API multipe times for large number of returned objects
         * you can use the $count API to get the number of returned objects.
         * In reality this is an OData call which has filter cababilty 
         * @link https://api.sap.com/api/sapdme_sfc/path/getOrderWorkListUsingGET
         * @param order
         *
         * @param plant
         * @returns the order info object
         * @description it requires valid selectionModel in the  POD
         * 
         */

        getWorklistDataSelectedOrder: async function (iOrder) {

            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/worklist/orders?";
                    var selection = this.getPodSelectionModel().getSelections();
                    //sfc is not used in the API
                    //var thesfc = selection[0].getSfc().getSfc();
                    var thePlant = this.getPodController().getUserPlant();
                    var theOperation = this._getWorkListSelectedOperationGlb();
                    var sfcResource = this.getPodSelectionModel().getResource().getResource();
                    var oView = this.getView();
                    var oModel = oView.getModel();

                    var oOrder = oModel.getProperty('/orderselect');

                    /**
                     * SAMPLES 
                     * var sUrl = that._oPluginController.getPublicApiRestDataSourceUri() + "/sfc/v1/worklist/orders?plant=" + that._getUserPlant();
                     *sUrl = sUrl + "&workCenter=" + sWorkCenter;
                     *    sUrl = sUrl + "&allSfcSteps=true&page.size=20&page.offset=" + iPageOffset;
                     * 
                     * "https://api./{regionHost}/sfc/v1/worklist/orders?page.size=20&allSfcSteps=false"
                     * "https://api./{regionHost}/sfc/v1/worklist/orders/$count?allSfcSteps=false")
                     * xhr.open("GET", "https://api.eu10.dmc.cloud.sap/sfc/v1/worklist/orders?page.size=20&filter.order=100122&allSfcSteps=false");
                     * 
                     */
                    sUrl = sUrl + "page.size=20";
                    sUrl = sUrl + "&page.offset=" + 0;
                    sUrl = sUrl + "&plant=" + thePlant;
                    // sUrl = sUrl + "&operation=" + theOperation;
                    //sUrl = sUrl + "&resource=" + sfcResource;
                    sUrl = sUrl + "&filter.order=" + oOrder;
                    //sUrl =sUrl + "&filter.operation="+theOperation;
                    sUrl = sUrl + "&allSfcSteps=true";

                    //this.ajaxGetRequest(sUrl, params, function (oResponseData)
                    this.ajaxGetRequest(sUrl, null, function (oResponseData) {
                        resolve(oResponseData);
                    }, function (Error) {
                        reject(Error);
                    });
                });
                return oResponseData;
            } catch (error) {
                this.showErrorMessage("sfc/v1/worklist/orders failed", true);
                this.resetButtonsWrkfl();

            }
          
        },

        /**
         * getWorkflexlistDataSelectedOrder
         * @param {*} iOrder 
         * @returns 
         */

        getWorkflexlistDataSelectedOrder: async function (iOrder) {

            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/worklist/orders?";
                    var selection = this.getPodSelectionModel().getSelections();
                    //sfc is not used in the API
                    //var thesfc = selection[0].getSfc().getSfc();
                    var thePlant = this.getPodController().getUserPlant();
                    var theOperation = this._getWorkListSelectedOperationGlb();
                    var sfcResource = this.getPodSelectionModel().getResource().getResource();
                    var oView = this.getView();
                    var oModel = oView.getModel();

                    var oOrder = oModel.getProperty('/orderselect');

                    /**
                     * SAMPLES 
                     * var sUrl = that._oPluginController.getPublicApiRestDataSourceUri() + "/sfc/v1/worklist/orders?plant=" + that._getUserPlant();
                     *sUrl = sUrl + "&workCenter=" + sWorkCenter;
                     *    sUrl = sUrl + "&allSfcSteps=true&page.size=20&page.offset=" + iPageOffset;
                     * 
                     * "https://api./{regionHost}/sfc/v1/worklist/orders?page.size=20&allSfcSteps=false"
                     * "https://api./{regionHost}/sfc/v1/worklist/orders/$count?allSfcSteps=false")
                     * xhr.open("GET", "https://api.eu10.dmc.cloud.sap/sfc/v1/worklist/orders?page.size=20&filter.order=100122&allSfcSteps=false");
                     * 
                     */
                   // sUrl = sUrl + "page.size=5";
                    //sUrl = sUrl + "&page.offset=" + 0;
                    sUrl = sUrl + "plant=" + thePlant;
                    // sUrl = sUrl + "&operation=" + theOperation;
                    //sUrl = sUrl + "&resource=" + sfcResource;
                    sUrl = sUrl + "&filter.order=" + oOrder;
                    sUrl = sUrl + "&page.size=20"
                    sUrl = sUrl + "&page.offset=0"
                    
                    //sUrl =sUrl + "&filter.operation="+theOperation;
                    sUrl = sUrl + "&allSfcSteps=true";

                    console.log(sUrl);

                    //this.ajaxGetRequest(sUrl, params, function (oResponseData)
                    this.ajaxGetRequest(sUrl, null, function (oResponseData) {
                        resolve(oResponseData);
                    }, function (Error) {
                        reject(Error);
                    });
                });
                return oResponseData;
            } catch (error) {
                this.showErrorMessage("sfc/v1/worklist/orders failed", true);
                this.resetButtonsWrkfl();
                throw error;

            }
           
        },

            /**
             * getSfcsInWork
             */
        

        getSfcsInWork: async function () {

            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcsInWork?page.size=100";

                    var selection = this.getPodSelectionModel().getSelections();
                    //sfc is not used in the API
                    //var thesfc = selection[0].getSfc().getSfc();
                    var thePlant = this.getPodController().getUserPlant();
                    var theOperation = this._getWorkListSelectedOperationGlb();
                    var sfcResource = this.getPodSelectionModel().getResource().getResource();
                    var oView = this.getView();
                    var oModel = oView.getModel();
                    var oOrder = oModel.getProperty('/orderselect');

                    /**
                     * SAMPLES 
                     * var sUrl = that._oPluginController.getPublicApiRestDataSourceUri() + "/sfc/v1/worklist/orders?plant=" + that._getUserPlant();
                     *sUrl = sUrl + "&workCenter=" + sWorkCenter;
                     *    sUrl = sUrl + "&allSfcSteps=true&page.size=20&page.offset=" + iPageOffset;
                     * 
                     * "https://api./{regionHost}/sfc/v1/worklist/orders?page.size=20&allSfcSteps=false"
                     * "https://api./{regionHost}/sfc/v1/worklist/orders/$count?allSfcSteps=false")
                     * xhr.open("GET", "https://api.eu10.dmc.cloud.sap/sfc/v1/worklist/orders?page.size=20&filter.order=100122&allSfcSteps=false");
                     * 
                     */


                    sUrl = sUrl + "&plant=" + thePlant;
                    sUrl = sUrl + "&resource=" + sfcResource;
                    //sUrl=sUrl + "&filter.order="+oOrder;

                    //this.ajaxGetRequest(sUrl, params, function (oResponseData)
                    this.ajaxGetRequest(sUrl, null, function (oResponseData) {
                        resolve(oResponseData);
                    }, function (Error) {
                        reject(Error);
                    });
                });
                return oResponseData;
            } catch (error) {
                this.showErrorMessage("getsfcsInWork failed", true);
                this.resetButtonsWrkfl();
            }

        },


        /** 
         * getComponentsForSfc
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
                    //any sfc in the order should work so pick the first one ?
                    var thesfc = selection[0].getSfc().getSfc();
                    var thePlant = this.getPodController().getUserPlant();

                    if (!thePlant || !thePlant) {
                        console.log("we have not made a selection");
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
                this.showErrorMessage("An error was detected: getComponentsForSfc", true);
                this.resetButtonsWrkfl();

            }
        },

        /**
         * getSfcStatus
         * @param {*} thesfc 
         * @returns 
         */

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
                this.showErrorMessage("An error was detected: " + error, true);

            }
        },
        /**
         * SfcStatusIsStartable wraps the calls to sfc/detail API in a promise
         * it possible to use asyc - wait 
         * 
         * @param {*} thesfc 
         * @returns 
         */

        getSfcStatusIsStartable: async function (thesfc) {

            try {
                //this will get startable sfcs from other operations as well

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
                this.showErrorMessage("An error was detected: getSfcStatusIsStartable ", true);
                this.resetButtonsWrkfl();
            }
        },

        /**
         *  classificationRead
         * @param {*} imaterial the material to read classification for.
         * @returns 
         */

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
                            //that.showSuccessMessage("classication called  succesfully!", true);
                            //oLogger.info("classification call success");
                            resolve(oResponseData);
                        },
                        //The error call back for the /classification/v1/read
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("Classsication API call failed " + sHttpErrorMessage);
                            that.showErrorMessage(oError, true);
                            reject(oError);
                        });
                });
                return oResponseData;
            } catch (error) {
                this.showErrorMessage("An error was detected: classificationRead ", true);
                this.resetButtonsWrkfl();
            }
        },


        /**
         * completeOrderSfcs 
         * @param {*} psfcs a list of sfcs to complete.
         * @returns 
         */
        completeOrderSfcs: async function (psfcs) {
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Nothing selected to complete");
                return;
            }
            //check for validation has happened
            let valdone = this.getView().getModel().getProperty("/validationDone");
            if (valdone === false) {
                this.showErrorMessage("No validation  Done ");
                return 0;

            }
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/complete?async=false";
            var sfcplant = this.getPodController().getUserPlant();
            var sfcOperation = this._getWorkListSelectedOperationGlb();
            var sfcResource = this.getPodSelectionModel().getResource().getResource();
            var selection = this.getPodSelectionModel().getSelections();

            var theQuantity = selection[0].sfcData.quantity;



            var ssfcParameters = {
                plant: sfcplant,
                operation: sfcOperation,
                quantity: theQuantity,
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
                            //oLogger.info("complete success");
                            resolve(oResponseData);
                        },
                        //The error call back for the sfc/v1/sfcs/complete?async=false"
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("Complete  API call failed " + sHttpErrorMessage);
                            // that.showErrorMessage(oError, true);

                            reject(oError);
                        });
                });
                return oResponseData;
            } catch (error) {
                this.showErrorMessage("An error was detected: completeOrderSfcs", true);
                this.resetButtonsWrkfl();
            }
        },

        /**
         * 
         * startAllSfcs
         * Marker400
         * It starts all sfcs in the passed array at Plant ,Operation ,
         * quantity and Resource
         * It will ***fail*** if the sfcs in the list are not startable(status.code == New(401) or Inqueque(402)
         * @param {*} sOperation 
         * @param {*} sPlant 
         * @param {*} sResource 
         * @param {*} sSfcs 
         * @returns  started sfcs if succesfull
         */

        startAllSfcs: async function (sOperation, sPlant, sResource, sSfcs) {

            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/start?async=false";
            //var sfcplant = this.getPodController().getUserPlant();
            //var sfcOperation = this._getWorkListSelectedOperationGlb(); //gloabal ch..ch..
            //var sfcResource = this.getPodSelectionModel().getResource().getResource();

            //TODO find the quantity
            var ssfcParameters = {
                operation: sOperation,
                plant: sPlant,
                resource: sResource,
                sfcs: sSfcs
            };
            var that = this;
            try {

            var oResponseData = await new Promise((resolve, reject) => {
                this.ajaxPostRequest(
                    sUrl,
                    ssfcParameters,
                    function (oResponseData) {
                        resolve(oResponseData);
                    },
                    function (oError, sHttpErrorMessage) {
                        var errval= oError || oError.message || sHttpErrorMessage;


                        oLogger.info("oError.error.message is= ",errval);
                       
                        that.showErrorMessage(`Error detected in Start Order:  + ${errval}`,true);
                        reject(errval);
                    });
            });
        }catch (oError){
            throw oError;

        }
        return oResponseData;


        },

        /**
         * getAllSfcsInOrderSameOperation (in progress)
         * @param {*} porder 
         * @param {*} poperation 
         * @returns 
         */

        getAllSfcsInOrderSameOperation: async function (porder, poperation) {
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
                that._debugGlb("getAllSfcInOrderSameOperation Error");
                this.showErrorMessage("An error was detected: getAllSfcsInOrderSameOperation", true);
                this.resetButtonsWrkfl();

            }

        },
        /**
         * getAllSfcsInOrder
         * @param {*} porder the order which to get all sfcs
         * @returns 
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
                this.showErrorMessage("An error was detected: getAllSfcsInOrder", true);
                this.resetButtonsWrkfl();

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

        onValidateResource: async function (evt) {
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Nothing selected to Validate resource");
                return;
            }

            var sfcResource = this.getPodSelectionModel().getResource().getResource();
            try {
                var res = await this.getResourceV2(sfcResource);
                if (res) {
                    console.log(res);
                    let rStatus = res[0].status;


                    this.showSuccessMessage(`The resource status is: ${rStatus}`);
                }

            } catch (oError) {
                this.showErrorMessage("failed to validate resource : API");
            }

        },


        /**
         * bValidateResForStart
         * validates the resource to either be ACTIVe or PRODUCTIVE
         * return true or false if the condition above is not true
         * @param {*} res resource ( selected most propably )
         * @param {*} plant T(he current plant most propably)
         * @returns 
         */
        bValidateResForStart: async function (res, plant) {
            try {
                var resData = await this.getResourceV2(res);
                if (resData) {

                    let rStatus = resData[0].status;
                    return (rStatus === "ENABLED" || rStatus === "PRODUCTIVE");
                }
                return false;

            }

            catch (oError) {

            }


        },



        /**
         * getResourceV2
         * 
         */
        getResourceV2: async function (res) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/resource/v2/resources";
            var iplant = this.getPodController().getUserPlant();
            var iparams = {
                plant: iplant,
                resource: res
            }

            try {
                var oResourceData = await new Promise((resolve, reject) => {
                    this.ajaxGetRequest(
                        sUrl,
                        iparams,
                        function (oResourceData) {
                            resolve(oResourceData);
                        }, function (oError, sHttpErrorMessage) {
                            reject(oError);

                        });
                });
                return oResourceData;

            }
            catch (oError) {
                throw oError;
            }
        },

        // planned components API Endpoint (from Asssembly)
        getplannedComponents: async function () {

            var sUrl = this.getPublicApiRestDataSourceUri() + "/assembly/v1/plannedComponents";
            //set the required params -plant and sfc
            var selection = this.getPodSelectionModel().getSelections();
            //any sfc will work since for Lutron all sfcs have the same components?
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


        /**
         * 
         * @param {} componentstovet 
         * @returns 
         */
        vetComponentsToValidate: async function (componentstovet) {
            var vettedComponents = [];
            var promises = componentstovet.map(item => {
                return this.bGetVettedComponent(item)
                    .then(isVetted => {
                        if (isVetted) {
                            vettedComponents.push(item);
                        }
                    });
            });
            try {
                await Promise.all(promises);
                return vettedComponents;
            } catch (error) {
                console.log(error);
            }
        },

        /**
         * 
         * @param {} componentstovet 
         * @returns 
         */
        vetComponentsToValidate: async function (componentstovet) {
            var vettedComponents = [];
            var promises = componentstovet.map(item => {
                return this.bGetVettedComponent(item)
                    .then(isVetted => {
                        if (isVetted) {
                            vettedComponents.push(item);
                        }
                    });
            });
            try {
                await Promise.all(promises);
                return vettedComponents;
            } catch (error) {
                console.log(error);
            }
        },

        /**
         * bGetVetttedComponent
         * @param {get} component 
         * @returns true if component will be validated false otherwise
         */
        bGetVettedComponent: async function (component) {
            //getClassification for the component
            var bVetting = await this.classificationRead(component);

            var cclasees = bVetting.classificationClasses; //an array of objects


            if (cclasees.length == 0) {
                //if there are no classification 
                // validate the component
                return true;
            }


            var characteristicDetails = cclasees[0].characteristicDetails;
            var cclassesLength = characteristicDetails.length;

            var oStatus = {
                bFoundYes: false,
                bFoundPartsExclusion: false,
                bFoundResourceExclusion: false,
                bMVisYes: function () { return this.bFoundYes === true; },
                bMVPisTrue: function () { return this.bFoundPartsExclusion === true; },
                bMVRisTrue: function () { return this.bFoundResourceExclusion === true; }
            };


            var plants = [];
            // go through all the characteristics for the component

            for (var i = 0; i < cclassesLength; i++) {

                var zname = characteristicDetails[i].name;

                if (zname === "Z_MATERIALVALIDATION") {
                    var zId = characteristicDetails[i].charcInternalId;
                    var classInternalId = zId;
                    var classificationAssignmentHeaders = bVetting.classificationAssignmentHeaders;
                    oStatus.bFoundYes = false;
                    for (let header of classificationAssignmentHeaders) {
                        if (header.assignmentCharacteristicValues) {
                            let match = header.assignmentCharacteristicValues.find(item => item.charcInternalId === classInternalId);
                            if (match && match.charcValue === "YES") {
                                oStatus.bFoundYes = true;
                                break;
                                //return true; // Match found with "YES", no need to check further (continue is correct here we need to go through all the characteristics)
                            }
                        }
                    }
                    // If we reach here, it means no match was found with "YES"
                    if (!oStatus.bFoundYes) {

                        return false; // No matching "YES" found in any header
                    }
                }
                if (zname === "Z_MATERIALVALIDATION_PLANT") {
                    var classInternalId = characteristicDetails[i].charcInternalId;
                    var classificationAssignmentHeaders = bVetting.classificationAssignmentHeaders;
                    var sCurrentPlant = this.getPodController().getUserPlant();
                    var foundPlantMatch = false;

                    for (let header of classificationAssignmentHeaders) {
                        if (header.assignmentCharacteristicValues) {
                            let match = header.assignmentCharacteristicValues.find(item => item.charcInternalId === classInternalId);
                            if (match && match.charcValue.includes(sCurrentPlant)) {
                                oStatus.bFoundPartsExclusion = true;
                                foundPlantMatch = true;
                                break; // Found a matching plant, no need to check further
                            }
                        }
                    }

                    if (!foundPlantMatch) {
                        oStatus.bFoundPartsExclusion = false;
                        // Continue to the next iteration if needed
                        continue;
                    } else {
                        return false; // Plant match found, exit with false
                    }
                }
                if (zname === "Z_MATERIALVALIDATION_RESOURCE") {
                    var classInternalId = characteristicDetails[i].charcInternalId;
                    var classificationAssignmentHeaders = bVetting.classificationAssignmentHeaders;
                    var currentResource = this.getPodSelectionModel().getResource().getResource();
                    var foundResourceMatch = false;

                    for (let header of classificationAssignmentHeaders) {
                        if (header.assignmentCharacteristicValues) {
                            let match = header.assignmentCharacteristicValues.find(item => item.charcInternalId === classInternalId);
                            if (match && match.charcValue.includes(currentResource)) {
                                oStatus.bFoundResourceExclusion = true;
                                foundResourceMatch = true;
                                break; // Found a matching resource, no need to check further
                            }
                        }
                    }

                    if (!foundResourceMatch) {
                        oStatus.bFoundResourceExclusion = false;
                        // Continue to the next iteration if needed
                        continue;
                    } else {
                        return false; // Resource match found, exit with false
                    }
                }

                if (0) {
                    if (zname === "Z_MATERIALVALIDATION") {

                        //TODO
                        //put some sanity checks in here to verify the properties exist.
                        var zId = characteristicDetails[i].charcInternalId;
                        var classInternalId = zId;
                        var arrClasssificationAssignmentHeaders = bVetting.classificationAssignmentHeaders;
                        var arrassignmentCharacteristicValues = arrClasssificationAssignmentHeaders[0].assignmentCharacteristicValues;

                        var index = arrassignmentCharacteristicValues.findIndex(function (item) {
                            return item.charcInternalId === classInternalId;
                        });

                        //we have the index into assignmentCharacteristicValues where the YES or NO values is 
                        var bYes = arrassignmentCharacteristicValues[index].charcValue === "YES" ? true : false;
                        //do we really need to verify that is NO ? what else can it be ?
                        if (!bYes) {
                            oStatus.bFoundYes = false;
                            return false;
                        } else {
                            // go to next iteration if any
                            oStatus.bFoundYes = true;
                            continue;
                        }
                    }







                    //Z_MATERIAL_VALIDATION Check
                    // work with the other cases
                    if (zname === "Z_MATERIALVALIDATION_PLANT") {
                        //TODO for debug , remove after verification
                        var cDetails = characteristicDetails[i];

                        var zId = characteristicDetails[i].charcInternalId;
                        var classInternalId = zId;
                        var arrClasssificationAssignmentHeaders = bVetting.classificationAssignmentHeaders;
                        var arrassignmentCharacteristicValues = arrClasssificationAssignmentHeaders[0].assignmentCharacteristicValues;

                        var index = arrassignmentCharacteristicValues.findIndex(function (item) {
                            return item.charcInternalId === classInternalId;
                        });
                        if (index !== -1) {
                            var plants = arrassignmentCharacteristicValues[index].charcValue;

                            var sCurrentPlant = this.getPodController().getUserPlant();
                            if (plants.includes(sCurrentPlant)) {
                                //TODO do we want to exit now ?, maybe the MATERIAL Validation has not happened yet
                                // maybe does not matter because if allow to continue if MV was no anyway and if is YES then is ok too.
                                oStatus.bFoundPartsExclusion = true;
                                return false;
                            } else {
                                oStatus.bFoundPartsExclusion = false;
                                continue;
                            }
                        } else {
                            oStatus.bFoundPartsExclusion = false;
                            continue;
                        }

                    } //Z_MATERIALVALIDATION_PLANT


                    if (zname == "Z_MATERIALVALIDATION_RESOURCE") {

                        var currentResource = this.getPodSelectionModel().getResource().getResource();
                        //In case that the properties are not available wrap in a try catch loop
                        try {
                            var zId = characteristicDetails[i].charcInternalId;
                            var classInternalId = zId;
                            var arrClasssificationAssignmentHeaders = bVetting.classificationAssignmentHeaders;
                            var arrassignmentCharacteristicValues = arrClasssificationAssignmentHeaders[0].assignmentCharacteristicValues;
                            var index = arrassignmentCharacteristicValues.findIndex(function (item) {
                                return item.charcInternalId === classInternalId;
                            });

                            //we have the index into assignmentCharacteristicValues where the resource to match is
                            if (arrassignmentCharacteristicValues[index].charcValue.includes(currentResource)) {
                                oStatus.bFoundResourceExclusion = true;

                            } else {
                                oStatus.bFoundResourceExclusion = false;

                            }
                        } catch (error) {
                            oStatus.bFoundResourceExclusion = false;
                        }

                    } //Z_MATERIALVALIDATION_RESOURCE
                }


            } //for
            //At this point we can say that MATERIAL_VALIDATION is YES because if NO
            // we have returned with false earlier in the loop 
            //if our planr included in the list of plants exclude the component
            var bOfy = oStatus.bFoundYes;
            var boPtrue = oStatus.bFoundPartsExclusion;
            var boRtrue = oStatus.bFoundResourceExclusion;

            if (oStatus.bFoundYes && oStatus.bFoundPartsExclusion) {
                return false;
            }
            if (oStatus.bFoundYes && (!oStatus.bFoundPartsExclusion) && oStatus.bFoundResourceExclusion) {
                return false;
            }
            //the MATERIAL_VALIDATION is still Yes and No exlusions.
            return true;
        },


        /**
         * 
         *              END DM APIs
         * marker2
         */

        /**
         * signOffAllSfcsOrderOperation
         * marker111
         * @param {*} evt 
         * @returns 
         */
        onsignOffAllSfcsOrderOperation: function (evt) {
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Selection was not found, Aborting");
                return;
            }

            //check for single sfc
            var selection = this.getPodSelectionModel().getSelections();
            if (selection.length > 1) {
                this.showErrorMessage("Please make a single Selection Only");
                return;
            }
            try {
                //this.showSuccessMessage("onTestWorkFlow clickd!");
                var eOrder = this.getView().byId("OrderValueLabel").getText();
                var res = this.signOffAllSfcsOrderOperation(eOrder, evt);

            } catch (error) {
                this.showErrorMessage("An error was detected: onsignoffAllSfcsOrderOperation:", true);
                this.resetButtonsWrkfl();
            }
            this.resetButtonsWrkfl();

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

        onEnterPressed(evt) {
            this.onValidateComponent();
        },

        onStartOrderSerialize: async function () {
            let retv = await this.startOrderSerialize();

        },
        /**
         * startOrderSerialize
         * 
         * Marker200
         * @returns Nothing
         */

        startOrderSerialize: async function () {

            //check for selection 
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Please make a Selection first.");
                return;
            }
            //check for single sfc
            var selection = this.getPodSelectionModel().getSelections();
            if (selection.length > 1) {
                this.showErrorMessage("Please make a single Selection Only");
                return;
            }
            //make sure the SFC is actually startable.
            var thesfc = selection[0].getSfc().getSfc();
            var theQuantity = selection[0].sfcData.quantity;


            //this.showErrorMessage(`sfc is = ${thesfc}`, true);
            let bCanStart = await this.getSfcStatusIsStartable(thesfc);

            if (!bCanStart) {
                this.showErrorMessage("selected SFC is not startable", true);
                return;
            }

            //validate Resource
            //Validate DataCollections
            var iOperation = this.getView().getModel().getProperty("/operation");
            var iPlant = this.getPodController().getUserPlant();
            var iResource = this.getView().getModel().getProperty("/resource");


            var valRes = await this.bValidateResForStart(iResource, iPlant);
            if (!valRes) {
                this.showErrorMessage("Resource status is not appropriate for Start");
                return;

            }

            var valdcRes = await this.getUncollectedParameters(thesfc, iOperation, iResource);
            if (valdcRes.uncollectedParams.length != 0) {
                this.showErrorMessage("Data Collection is not done");
                return;
            }

            console.log(`return value is ${valdcRes}`);
            //Validate Prt
            let validatePRT = this.getView().getModel().getProperty("/checkPrt");
            if (validatePRT) {
                try {
                    var prtval = await this.prtLoadingValidation();
                    //make sure that prtval is valid and accomodate a prt api failure
                    // check for undefined
                    if (!prtval || prtval.validationResult !== "PRT_PASSED") {
                        this.showErrorMessage("Tool validation failed , StartOrder Serialize will not continue");
                        return;
                    }
                } catch (error) {
                    this.showErrorMessage(error);
                    return;
                }
            }
            //end validatePRT

            //Start the single SFC (all quantity)


            var sSfcs = [thesfc];
            var startRes = await this.startAllSfcs(iOperation, iPlant, iResource, sSfcs);

            //Marker565
            let bLaborOn = this.getView().getModel().getProperty("/labor");
            if (bLaborOn) {
                var iOrder = this.getView().getModel().getProperty("/orderselect");
                var ppdParams = await this.getSFCDetailsForLaborOnPPD(thesfc,iOrder);
                 
                this.laborOnDialog().then(async inputValue => {
                    console.log('Dialog input value:', inputValue);
                    var noops = this.getView().getModel().getProperty("/numberOfOperators");
                    // call laborOn API.
                    try {
                        // var reslabor = await this.laborOn(noops);
                        var reslabor = await this.callAPPD(ppdParams,noops);
                        if (reslabor) {
                            this.showSuccessMessage("LaborOn start executed!", true);
                        } else {
                            this.showErrorMessage("labor did not execute", true);

                        }
                    } catch (oError) {

                        console.log("error in laborOn");
                        oLogger.info("Error in laborOn 1619");
                        this.showErrorMessage("Labor On start failure");
                        //throw oError;
                    }
                }).catch(error => {
                    console.error('Dialog error:', error);
                });
            } // end if labor on

            //do the serialize
            var cQuantity = parseInt(theQuantity);
            cQuantity = cQuantity - 1;
            if (cQuantity === 1) {
                //nothing to do 
                return;
            }
            //this.showErrorMessage(`quantity to serialize is =${cQuantity}`,true);


            //Loop with chuncks of quantity of 300 until sfc quantity <=0

            //call Serialize sfc API
            while (cQuantity > 0) {
                let isubv = (cQuantity > 300) ? 300 : cQuantity;
                try {
                    let serRes = await this.serializefcAPI(thesfc, isubv);
                } catch (error) {
                    this.showErrorMessage("Error in serialize API", true);
                    return;

                }

                cQuantity -= isubv;
            }
            this.showSuccessMessage("Start Order/Split is completed", true);

            //Done (dont we need to set the quantity on the original sfc to 1?)
            // we need to check if SerializeAPI does this automatically (subtracts from the quantity)
            //var qRes= await this.sfcSetQuantity(1)

        },

        laborOnDialog: async function () {

            var that = this; // Store reference to outer this
            return new Promise((resolve, reject) => {
                var oDialog = new sap.m.Dialog({
                    title: "Labor On Details",
                    content: [
                        new sap.m.Label({ text: "Total Number of Operators" }),
                        new sap.m.Input({ type: "Number", value: 0, id: "inputControl" })
                    ],
                    buttons: [
                        new sap.m.Button({
                            text: "OK",
                            type: "Emphasized",
                            press: function () {
                                var inputValue = sap.ui.getCore().byId("inputControl").getValue();
                                that.getView().getModel().setProperty("/numberOfOperators", inputValue); // Use that instead of this
                                oDialog.close();
                                oDialog.destroy();
                                console.log("Input Value: ", inputValue);
                                resolve(inputValue);
                            }
                        }),
                        new sap.m.Button({
                            text: "Cancel",
                            press: function () {
                                oDialog.close();
                                oDialog.destroy();
                                console.log("Input Value: ", -1);
                                that.getView().getModel().setProperty("/numberOfOperators", -1); // Use that instead of this
                                reject('Dialog cancelled');
                            }
                        })
                    ]
                });

                oDialog.open();
            });
        },



        /**
         *  SerializeAPI
         * Marker300
         * @param {} thesfc 
         * @param {*} pquantity 
         * @returns 
         */
        serializefcAPI: async function (thesfc, pquantity) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/serialize?async=false";
            var sfcplant = this.getPodController().getUserPlant();

            var ssfcParameters = {
                plant: sfcplant,
                sfc: thesfc,
                newSfcs: [],
                quantity: pquantity,
                copyWorkInstructionData: true,
                copyComponentTraceabilityData: true,
                copyNonConformanceData: true,
                copyBuyoffData: true,
                copyDataCollectionData: true,
                copyActivityLogData: true

            };
            var that = this;

            var oResponseData = await new Promise((resolve, reject) => {
                this.ajaxPostRequest(
                    sUrl,
                    ssfcParameters,
                    function (oResponseData) {
                        resolve(oResponseData);
                    },
                    function (oError, sHttpErrorMessage) {

                        oLogger.info("oError.error.message is= ", oError.error.message);
                        oLogger.info("Errors - sfc serialize sHttpErrorMessage is =  " + sHttpErrorMessage);
                        that.showErrorMessage("Error detected in serialize SFC API : " + oError.error.message);
                        reject(oError);
                    });
            });
            return oResponseData;

        },

        getUncollectedParameters: async function (thesfc, oOperation, oResource) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/datacollection/v1/uncollectedParameters";
            //set the required params -plant and sfc
            var selection = this.getPodSelectionModel().getSelections();

            var oPlant = this.getPodController().getUserPlant();

            var params = {

                sfc: thesfc,
                operation: oOperation,
                resource: oResource,
                plant: oPlant
            }
            var that = this;

            var oResponseData = await new Promise((resolve, reject) => {
                this.ajaxGetRequest(
                    sUrl,
                    params,
                    function (oResponseData) {
                        that._debugGlb("response reached");


                        resolve(oResponseData);
                    }, function (oError, sHttpErrorMessage) {
                        reject(oError);

                    });


            }); //cp
            return oResponseData;

        },

        sfcSetQuantity: async function (iQuantity) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/setQuantity";
            var sfcplant = this.getPodController().getUserPlant();

            var ssfcParameters = {
                plant: sfcplant,
                sfcQuantityRequests: [{
                    sfc: thesfc, quantity: iQuantity
                }
                ]
            };
            var that = this;

            var oResponseData = await new Promise((resolve, reject) => {
                this.ajaxPostRequest(
                    sUrl,
                    ssfcParameters,
                    function (oResponseData) {
                        resolve(oResponseData);
                    },
                    function (oError, sHttpErrorMessage) {

                        oLogger.info("oError.error.message is= ", oError.error.message);
                        oLogger.info("Errors - sfc serialize sHttpErrorMessage is =  " + sHttpErrorMessage);
                        that.showErrorMessage("Error detected in sfcSetQuantit API : " + oError.error.message);
                        reject(oError);
                    });
            });
            return oResponseData;


        },

        onTestLaborOn: async function onTestLaborOn() {
            try {
                var lbon = await this.laborOn(3);

            } catch (oError) {
                console.log(oError);

            }

        },


        /**
         * LaborOn
         * @returns 
         */

        laborOn: async function (nofops) {

            var sUrl = this.getPublicApiRestDataSourceUri() + "/timetracking/v1/direct-labor/start";
            //var sUrl = "https://api.test.us20.dmc.cloud.sap/timetracking/v1/direct-labor/start";
            //var surli="https://api.test.us10.dmc.cloud.sap/timetracking/v1/direct-labor/start";

            var sfcplant = this.getPodController().getUserPlant();
            var iOperation = this.getView().getModel().getProperty("/operation");
            var iResource = this.getView().getModel().getProperty("/resource");
            var iOrder = this.getView().getModel().getProperty("/orderselect");
            var altWc = this.getView().getModel().getProperty("/workCenter");


            var selection = this.getPodSelectionModel().getSelections();
            var thesfc = selection[0].getSfc().getSfc();
            var r = selection[0].sfcData.routing;
            var rType = "SHOPORDER_SPECIFIC"; //selection[0].sfcData.routingType;
            var rVersion = selection[0].sfcData.routingVersion;
            var workC = selection[0].sfcData.workCenter;
            var oStepId = selection[0].sfcData.stepId;
            var iUserId = this.getPodController().getUserId();

            //assume single selection



            var ssparamstest = {
                numberOfOperators: 2,
                operation: "ASSEMBLY-3579",
                operationVersion: "ERP001",
                plant: "PQ01",
                resource: "3579",
                routing: "1000559",
                routingType: "SHOPORDER_SPECIFIC",
                routingVersion: "ERP001",
                sfc: "1000559-21087",
                shopOrder: "1000559",
                stepId: "0030",
                userId: "christina.demuth@syntax.com",
                workCenter: "3579"


            };
            var ssfcParameters = {
                numberOfOperators: 2,
                operation: iOperation,
                plant: sfcplant,
                resource: iResource,
                routing: r,
                routingType: "SHOPORDER_SPECIFIC",//rType,
                routingVersion: rVersion,
                sfc: thesfc,
                shopOrder: iOrder,
                stepId: oStepId,
                userId: "ilias.skordilis@syntax.com",
                workCenter: altWc

            };
            var that = this;
            try {

                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            resolve(oResponseData);
                        },
                        function (oError, sHttpErrorMessage) {

                            // oLogger.info("oError.error.message is= ", oError.error.message);
                            oLogger.info("Errors - Direct labor sHttpErrorMessage is =  " + sHttpErrorMessage);
                            that.showErrorMessage(`Error detected inDirect Labor API : ${sHttpErrorMessage}`);
                            reject(oError);
                        });
                });
                return oResponseData;
            } catch (oError) {
                throw oError;
            }

        },
        /**
         * mergeSfcsAPI
         * @param {parent sfc } iParentSfc 
         * @param {source sfcs to merge} iSourceSfc 
         * @returns 
         */
        mergeSfcsAPI: async function (iParentSfc, iSourceSfc) {

            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/merge?async=false";
            var sfcplant = this.getPodController().getUserPlant();

            var ssfcParameters = {
                plant: sfcplant,
                parentSfc: iParentSfc,
                sourceSfcs: iSourceSfc,
                mergeAcrossOperations: false,
                copyWorkInstructionData: true,
                copyComponentTraceabilityData: true,
                copyNonConformanceData: true,
                copyBuyoffData: true,
                copyDataCollectionData: true,
                copyActivityLogData: true

            };
            var that = this;
            try {

                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            resolve(oResponseData);
                        },
                        function (oError, sHttpErrorMessage) {
                            reject(oError);

                        });
                });
                return oResponseData;
            } catch (oError) {

                oLogger.info("oError.error.message is= ", oError.message);
                throw oError;

            }
        },

        /**
         * onSfcDone
         * Marker 512
         */
        onSfcDone: async function () {
            //check selection exist

            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Please make a Selection first.");
                return;
            }

            try {
                let res = await this.sfcDone();

            } catch (error) {
                console.log(error);
                this.showErrorMessage(error);
            }
        },

        /**
         * sfcDone
         * Marker 520
         */
        sfcDone: async function () {
            var selection = this.getPodSelectionModel().getSelections();
            if (selection.length > 1) {
                this.showErrorMessage("Please  select a single SFC to Merge with all other SFCs in the Order");
                return;
            }
            //get the worklist data and the selected sfc

            try {
                var oWorkListData = await this.getWorklistDataSelectedOrder();
                var thesfc = selection[0].getSfc().getSfc();
                var theRouting = selection[0].sfcData.routing;


            } catch (error) {
                oLogger.info(`getWorklistDataSelectedOrder: Error : ${error}`);
                throw error;
            }
            // get all Sfcs in the order  from the result of the getWorklistDataSelectedOrder;

            var allSfcs = oWorkListData[0].orderSfcs;

            //check for SFCs on HOLD
            try {
                var onHoldSFCSarr = await this.filterSFCsonHold(allSfcs);
            } catch (error) {
                throw error;
            }

            //if we found sfcs on hold show an error message and return

            if (onHoldSFCSarr.length > 0) {
                this.showErrorMessage("There are SFCs on Hold. Cannot proceed.");
                return;
            }

            //ask for confirmation if the user really wants to discard the order

            try {
                var choice = await this.OpenConfirmationDialog("Are you sure you want to discard the Order ?");
                if (!choice) {
                    return 0;  // or reject("aborted!")
                }

            } catch (error) {
                throw error;
            }
            var sfcplant = this.getPodController().getUserPlant();



            //Now we can merge the sfcs-after we filter for active sfcs
            // signoff the active sfcs 
            // Make the selected SFC the parent SFC and all other sfcs the sources
            //after you filter for active sfcs and signoff
            try {
                var activesfcs = await this.filterActiveSFCsAlt(allSfcs, this._getWorkListSelectedOperationGlb());

            } catch (error) {
                oLogger.INFO(error);
                throw error;
            }
            console.log(activesfcs);
            //Summary:
            //In Order to merge SFCs , we will find the active SFCS from the order selected
            // will signoff all the the active sfcs
            // then the selected sfc becomes the parent and the rest the source to call 
            //the Merge API -- corrections needed below.
            //signOff all the active sfcs 
            // thesfc is the selected sfc
            // activesfc is all the sfcs
            // we also need to check if the selected sfc is in queue

            //signoff the sfcs in the order  that are active
            if (activesfcs.length != 0) {
                //Marker6000
                try {
                    var oView = this.getView();
                    var oModel = oView.getModel();
                    var iOrder = oModel.getProperty('/orderselect');
                    if (!iOrder) {
                        this.showErrorMessage("No Selection was found for Order");
                        return;
                    }
                    var signedoff = await this.signOffAllSfcsOrderOperation(iOrder);

                } catch (oError) {
                    throw oError;
                }
            }

            //at this point activesfcs contain sfcs in Queue but only the ones that were
            // signedoff
            // we need to get now all the sfcs in queue or new 
            // to be merged ?
            // is necessary to call worklistData again since the statuses have changed from the signoff

            try {
                var oWorkListData = await this.getWorklistDataSelectedOrder();
                var tobeFilteredSFCs = oWorkListData[0].orderSfcs;

                var iSfcsToMerge = await this.filterInQueueSFCsAlt(tobeFilteredSFCs, theRouting);


            } catch (oError) {
                throw oError;
            }

            //Merge SFCs 
            //check if we only have one sfc in the returned list 

            if (iSfcsToMerge.length <= 1) {
                this.errorMessage("Not enough SFCs to Merge must have more than 1");
                return;
            }

            try {


                let thesfcexcluded = iSfcsToMerge.filter(item => item !== thesfc);
                var responseData = await this.mergeSfcsAPI(thesfc, thesfcexcluded);

            } catch (error) {
                this.showErrorMessage("Merge failed ", true);
                throw error;
            }

            //log Non Conformance from the resulting Merged SFC
            // the sfc
            // the SFC to log the non conformance  is provided by the responseData
            // returned by the mergeSFCsAPI above 
            // pass the parent sfc used in the Merge sfc



            try {
                var sfcarr = [];
                sfcarr[0] = thesfc;
                var responseNc = await this.logNonConformanceAPI(sfcarr, sfcplant);

            } catch (error) {
                throw error;
            }

            //disregard Order 

            try {

                var dOrder = await this.disregardOrder();

            } catch (oError) {
                throw oError;

            }

        }, //end SfcDone

        /**
         * logNonConformanceAPI
         */
        logNonConformanceAPI: async function (sfcArr, iPlant) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/nonconformance/v1/log";
            var sfcplant = this.getPodController().getUserPlant();

            var ssfcParameters = {
                code: "SFC_DONE",
                plant: sfcplant,
                sfcs: sfcArr,

            };
            var that = this;
            try {

                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            resolve(oResponseData);
                        },
                        function (oError, sHttpErrorMessage) {
                            reject(oError);


                        });
                });
                return oResponseData;
            } catch (error) {
                oLogger.info("oError.error.message is= ", error.message);
                that.showErrorMessage("Error detected in  NonConfrmance log   API : " + error.message);

                throw error;
            }

        },


        dispositionNCAPI: async function () {

            var sUrl = this.getPublicApiRestDataSourceUri() + "/nonconformance/v1/sfcs/disposition";
            var sfcplant = this.getPodController().getUserPlant();

            var ssfcParameters = {
                plant: sfcplant,
                sfcs: []


            };
            var that = this;

            var oResponseData = await new Promise((resolve, reject) => {
                this.ajaxPostRequest(
                    sUrl,
                    ssfcParameters,
                    function (oResponseData) {
                        resolve(oResponseData);
                    },
                    function (oError, sHttpErrorMessage) {

                        oLogger.info("oError.error.message is= ", oError.error.message);
                        oLogger.info("Errors - Disposition Sfcs sHttpErrorMessage is =  " + sHttpErrorMessage);
                        that.showErrorMessage("Error detected in Disposition SFC  API : " + oError.error.message);
                        reject(oError);
                    });
            });
            return oResponseData;

        },

        onOrderDiscard: async function () {
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Please make a selection first");
                return;
            }
            try {
                disOrder = await this.discardOrder();

            } catch (oError) {
                this.showErrorMessage(oError.message);
            }

        },

        /**
         * discardOrder
         * Assumes and order is selected and gets 
         * the order from the selection.
         * @returns 
         */

        discardOrder: async function () {
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Please make a selection first");
                return;
            }

            var sUrl = this.getPublicApiRestDataSourceUri() + "/order/v1/orders/discard";
            var sfcplant = this.getPodController().getUserPlant();
            var eOrder = this.getView().getModel().getProperty("/orderselect");


            var ssfcParameters = {
                order: eOrder,
                plant: sfcplant
            };
            var that = this;
            try {
                var oResponseData = await new Promise((resolve, reject) => {
                    this.ajaxPostRequest(
                        sUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            resolve(oResponseData);
                        },
                        function (oError, sHttpErrorMessage) {

                            oLogger.info("oError.error.message is= ", oError.message);
                            oLogger.info("Errors - Disregard Order sHttpErrorMessage is =  " + sHttpErrorMessage);
                            //that.showErrorMessage("Error detected in Disregard Order  API : " + oError.message);
                            reject(oError);
                        });
                });
                return oResponseData;
            } catch (oError) {
                throw oError;
            }

        },




        /**
         * User clicked on SplitSFC/Relabel
         * @param {*} evt 
         * @returns 
         */

        onSplitSfc: async function (evt) {

            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Please make a selection first");
                return;
            }
            var selection = this.getPodSelectionModel().getSelections();
            if (selection.length > 1) {
                this.showErrorMessage("Please make a single Selection Only");
                return;
            }


            this.openSplitSfcDialog();
        },

        onRelabelSfc: async function (evt) {

            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("Please make a selection first");
                return;
            }
            var selection = this.getPodSelectionModel().getSelections();
            if (selection.length > 1) {
                this.showErrorMessage("Please make a single Selection Only");
                return;
            }

            this.openRelabelSfcDialog();

        },
        openSplitSfcDialog: function () {
            var eOrder = this.getView().getModel().getProperty("/orderselect");
            var eMaterial = this.getView().getModel().getProperty("/material");
            var selection = this.getPodSelectionModel().getSelections();
            var thesfc = selection[0].getSfc().getSfc();
            var theQuantity = selection[0].sfcData.quantity;

            var eMaterialeOrder = eMaterial + "-" + eOrder;
            var that = this;

            var oSplitSfcInput = new sap.m.Input({
                change: function (oEvent) {
                    var newValue = oEvent.getParameter("value");
                    var splitnewSfc = eMaterialeOrder + "-" + newValue;
                    var csplitnewSfc = splitnewSfc.toUpperCase();
                    oNewSfcValueLabel.setText(csplitnewSfc);
                }
            });

            var oSfcValueLabel = new sap.m.Label();
            var oAvailableQuantityValueLabel = new sap.m.Label({ design: sap.m.LabelDesign.Bold });
            var oQuantityToSplitInput = new sap.m.Input();
            var oNewSfcValueLabel = new sap.m.Label({ design: sap.m.LabelDesign.Bold });

            var oDialog = new sap.m.Dialog({
                title: 'Split Sfc',
                content: [
                    new sap.m.VBox({
                        items: [
                            new sap.m.Label({ text: 'Serial #', design: sap.m.LabelDesign.Bold }),
                            oSplitSfcInput,
                            new sap.m.Label({ text: 'SFC', design: sap.m.LabelDesign.Bold }),
                            oSfcValueLabel,
                            new sap.m.Label({ text: 'available Quantity', design: sap.m.LabelDesign.Bold }),
                            oAvailableQuantityValueLabel,
                            new sap.m.Label({ text: 'quantity to split', design: sap.m.LabelDesign.Bold }),
                            oQuantityToSplitInput,
                            new sap.m.Label({ text: 'New SFC', design: sap.m.LabelDesign.Bold }),
                            oNewSfcValueLabel
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new sap.m.Button({
                    text: 'Split',
                    type: sap.m.ButtonType.Emphasized,
                    press: function () {
                        var splitSfcValue = oSplitSfcInput.getValue();
                        var quantityToSplitValue = oQuantityToSplitInput.getValue();

                        if (!splitSfcValue || !quantityToSplitValue) {
                            that.showErrorMessage("Please enter valid values");
                            return;
                        }
                        if (parseInt(quantityToSplitValue) > parseInt(theQuantity)) {
                            that.showErrorMessage("Quantity should be less than available quantity.");
                            return;
                        }

                        //format the split sfc materialOrder+"whatever user/scanner entered"

                        var splitnewSfc = eMaterialeOrder + "-" + splitSfcValue;
                        var csplitnewSfc = splitnewSfc.toUpperCase();
                        that.splitSfcAPI(thesfc, csplitnewSfc, quantityToSplitValue).then(response => {
                            console.log(response);
                            that.showSuccessMessage("split done", true);
                            oDialog.close();
                        }).catch(error => {
                            console.error(error);
                            that.showErrorMessage("An error occurred while splitting");
                        });
                    }
                }),
                endButton: new sap.m.Button({
                    text: 'Cancel',
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oSfcValueLabel.setText(thesfc);
            let cQuantity = parseInt(theQuantity);
            oAvailableQuantityValueLabel.setText(cQuantity);
            oQuantityToSplitInput.setValue("1");
            oNewSfcValueLabel.setText("....");

            oDialog.open();
        },


        /**
         * 
         * Marker700
         */
        openRelabelSfcDialog: async function () {

            var eOrder = this.getView().getModel().getProperty("/orderselect");
            var eMaterial = this.getView().getModel().getProperty("/material");
            var selection = this.getPodSelectionModel().getSelections();
            var thesfc = selection[0].getSfc().getSfc();
            var eMaterialeOrder = eMaterial + "-" + eOrder;

            var that = this;



            var oOriginalSfcLabel = new sap.m.Label({ text: 'Original SFC', design: sap.m.LabelDesign.Bold });
            var oNewSfcLabel = new sap.m.Label({ text: 'New SFC', design: sap.m.LabelDesign.Bold });
            var oAncdeLabel = new sap.m.Label({ text: thesfc, design: sap.m.LabelDesign.Bold });
            var oNewSfcInput = new sap.m.Input({
                change: function (oEvent) {
                    // Get the new value
                    //Marker700
                    var newValue = oEvent.getParameter("value");
                    var relabelnewSfc = eMaterialeOrder + "-" + newValue;
                    var bErrorsFound = false;
                    var crelabelnewSfc = relabelnewSfc.toUpperCase();
                    try {

                        that.relabelSfcAPI(thesfc, crelabelnewSfc).then(response => {
                            that.showSuccessMessage("relabel done", true);

                        })
                            .catch(error => {

                            });

                    } catch (error) {
                        this.showErrorMessage("Error in relabel SFC API",);
                        bErrorsFound = true;
                        return;


                    }
                    // Handle the new value here
                    console.log('New SFC Value:', newValue);
                    oDialog.close();
                    //if(!bErrorsFound){
                    //    that.showSuccessMessage("relabel done", true);
                    //}

                }
            });

            var oDialog = new sap.m.Dialog({
                title: 'SFC Relabel',
                content: [
                    new sap.m.FlexBox({
                        justifyContent: "SpaceBetween",
                        items: [
                            oOriginalSfcLabel,
                            oNewSfcLabel
                        ]
                    }).addStyleClass("sapUiSmallMargin"),
                    new sap.m.FlexBox({
                        justifyContent: "SpaceBetween",
                        items: [
                            oAncdeLabel,
                            oNewSfcInput
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new sap.m.Button({
                    text: 'Relabel',
                    type: sap.m.ButtonType.Emphasized,
                    press: function () {
                        // Handle the Relabel button press here
                        var newSfcValue = oNewSfcInput.getValue();

                        console.log('New SFC Value:', newSfcValue);

                        oDialog.close();
                    }
                }),
                endButton: new sap.m.Button({
                    text: 'Cancel',
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.open();
        },
        /**
         * splitSfcAPI
         * @param {*} xcsfc the sfc 
         * @param {*} nssfc the new sfc
         * @returns 
         */

        splitSfcAPI: async function (xcsfc, nssfc, iQuantity) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/split?async=false";
            var sfcplant = this.getPodController().getUserPlant();
            var csfc = xcsfc; //sfc to split


            //TODO find the quantity
            // Marker80
            var nsfc = {

                sfc: nssfc, //new sfc
                defaultBatchid: "",
                quantity: iQuantity,
            }

            var ssfcParameters = {
                plant: sfcplant,
                sfc: csfc,
                newSfcs: [nsfc]
            };
            var that = this;


            var oResponseData = await new Promise((resolve, reject) => {
                this.ajaxPostRequest(
                    sUrl,
                    ssfcParameters,
                    function (oResponseData) {
                        resolve(oResponseData);
                    },
                    function (oError, sHttpErrorMessage) {

                        //oLogger.info("oError.error.message is= ", oError.error.message);
                        oLogger.info("Errors - sfc split sHttpErrorMessage is =  " + sHttpErrorMessage);
                        that.showErrorMessage("Error detected in splitSFC : " + oError.error.message);
                        reject(oError);
                    });
            });
            return oResponseData;

        },

        relabelSfcAPI: async function (xcsfc, nssfc) {
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/relabel?async=false";

            var sfcplant = this.getPodController().getUserPlant();
            var csfc = xcsfc; //sfc to relabel




            var ssfcParameters = {
                plant: sfcplant,
                sfc: csfc,
                newSfc: nssfc
            };
            var that = this;


            var oResponseData = await new Promise((resolve, reject) => {
                this.ajaxPostRequest(
                    sUrl,
                    ssfcParameters,
                    function (oResponseData) {
                        resolve(oResponseData);
                    },
                    function (oError, sHttpErrorMessage) {

                        oLogger.info("oError.error.message is= ", oError.error.message);
                        oLogger.info("Errors - sfc relabel sHttpErrorMessage is =  " + sHttpErrorMessage);
                        that.showErrorMessage("Error detected in relabelSFC : " + oError.error.message);
                        reject(oError);
                    });
            });
            return oResponseData;

        },

        /**
         * onStartOrderEnhanced
         * 
         * @param {*} evt 
         * @returns 
         */

        onStartOrderEnhanced: async function (evt) {
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("No Order is selected");
                return;
            }
            try {
                // var eOrder = this.getView().byId("OrderValueLabel").getText();
                var eOrder = this.getView().getModel().getProperty("/orderselect");
                var res = await this.StartOrderEnhanced(eOrder, evt);
            } catch (error) {
                var msg = (!error) ? "onStartOrderEnhanced" : error.message;
                this.showErrorMessage("An Error was detected: " + msg);
                this.resetButtonsWrkfl();
            }
        },
        /**
         * StartOrderEnhanced
         * @param {*} eOrder 
         * @param {*} tevt ?
         * @returns 
         */
        StartOrderEnhanced: async function (eOrder, tevt) {

            if (!eOrder) {
                this.showErrorMessage("Order Not selected");
                return;
            }
            var oValidationButton = this.getView().byId("ValidateCompType");
            var oStartOrderButton = this.getView().byId("OrderStartType");
            var oCompleteButton = this.getView().byId("CompletComp");
            //var sfcUrl =this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/start?async=false";
            var sfcplant = this.getPodController().getUserPlant();
            var sfcOperation = this._getWorkListSelectedOperationGlb(); //gloal ch..ch..
            var sfcResource = this.getView().getModel().getProperty("/resource");
            //var sfcResource = this.getPodSelectionModel().getResource().getResource();
            var oconfig = this.getConfiguration();
            console.log(oconfig);

            /********************* Check PRT ****************************/
            var prtval = await this.prtLoadingValidation();
            //make sure that prtval is valid and accomodate a prt api failure
            // check for undefined
            if (!prtval || prtval.validationResult !== "PRT_PASSED") {
                this.showErrorMessage("Tool validation failed , StartOrder will not continue");
                return;
            }

            oLogger.info("retuls of prtLoadingValidation is: " + prtval.validationResult);
            /********************* End Check PRT*** *********************/
            oStartOrderButton.setBusy(true);


            //Get all the sfcs in the order
            try {
                var allSfcs = await this.getAllSfcsInOrder(eOrder);
            } catch (error) {
                this.showErrorMessage("failed to get Sfc's for the Order: " + eOrder, true, true);
                this.resetButtonsWrkfl();
            }
            oLogger.info("sfcs found in Order  " + allSfcs.length);

            /**************************** Filter for only startable sfcs */
            try {
                var sfcstostart = await this.filterStartableSFCs(allSfcs);

                // 
            } catch (error) {
                this.showErrorMessage("An error was detected: StartOrderEnhanced ", true);
                this.resetButtonsWrkfl();
            }
            oLogger.info("startablesfcs size  " + sfcstostart.length);
            var vlength = sfcstostart.length;
            // if vlength === 0 the API call to start will be bypassed
            //Start the loop going through all the chunck of sfcs
            var sfcstocomplete = [];
            var sfcstocompletelength = 0;
            if (!vlength === 0) {
                // Assume that the sfc's will be started
                // so the completesfc will take the value of sfctostart
                // which after the start will have status of ACTIVE
                sfcstocomplete = sfcstostart;
            } else {
                //TODO this will fail if sfcs are have status on HOLD etc
                sfcstocomplete = allSfcs;
                sfcstocompletelength = allSfcs.length;
            }
            //bypass this loop if VALIDATE or COMPLETE
            /**go through a loop with step SFCS_CHUNK to start all sfcs */
            oStartOrderButton.setBusy(true);
            for (let i = 0; i < vlength; i += SFCS_CHUNK) {


                let startSFCChunk = sfcstostart.slice(i, i + SFCS_CHUNK);

                /** API Call to start all SFCS************** *********/

                var chunckStartd = await this.startAllSfcs(
                    sfcOperation,
                    sfcplant,
                    sfcResource,
                    startSFCChunk
                );

                var isfail = (typeof chunckStartd === 'undefined') ? true : false;

                this.showErrorMessage((typeof chunckStartd === 'undefined'), true);
                if (isfail) {
                    oStartOrderButton.setBusy(false);
                }
                //delay for 1s give the gateway chance to cope
                var waitfor = await this.delay(1000);
            }
            /****************** End of  LOOP to startall sfcs ***********/
            oStartOrderButton.setBusy(false);

            if (oconfig.executeStartOrderOnlyVisible) {
                return;
            }
            //************* Validation starts here ********************

            oValidationButton.setBusy(true);
            try {
                var theComponents = await this.getComponentsForSfc();
            } catch (error) {
                this.showErrorMessage("An error was detected:getComponentsForSfc ", true);
                this.resetButtonsWrkfl();
            }

            // tranform theComponents into single row array with just the component
            var tranformedComponents = this.transformComponentData(theComponents);
            //vet the components against the classificaton entry
            var vetted = await this.vetComponentsToValidate(tranformedComponents);

            if ((typeof vetted === 'undefined')) {
                //This is wrong masking the problem but is only for debug purposes.
                // also it might not be a problem and all components 
                // were excluded in the Vetting with Classification filters.
                vetted = "";
                this.showErrorMessage("There are not components to Validate", true);
            }
            oLogger.info(" vetted= " + vetted);

            //now create a table Model only with the vetted components
            // and put it into the View Model
            // in case is the vetted array is empty it means to bypass
            // the validation
            if (vetted.length !== 0) {
                var componetsModel = this.ComponentAPISucsess(theComponents, vetted);

                try {
                    var theDialog = await this.openValidateDialog();
                    console.log("theDialog=" + theDialog);
                    oValidationButton.setBusy(false);
                    if (theDialog !== COMPONENT_VALIDATION_SUCCESS) {
                        //set a valid state first
                        oValidationButton.setBusy(false);
                        oCompleteButton.setBusy(false);
                        oStartOrderButton.setBusy(false);
                        return;
                    }
                } catch (error) {
                    this.showErrorMessage("An error was detected: openValidateDialog() ", true);
                    this.resetButtonsWrkfl();

                }
            } // if (vetted)
            else {
                this.resetButtonsWrkfl();
            }
            oCompleteButton.setBusy(true);
            //****** Validation  ends here ******************************

            //****** Complete starts here *******************************
            //Now start the loop to complete all sfcs
            for (let i = 0; i < sfcstocompletelength; i += SFCS_CHUNK) {

                try {
                    let startSFCChunk = sfcstocomplete.slice(i, i + SFCS_CHUNK);
                    var bcompleted = await this.completeOrderSfcs(startSFCChunk);
                    //TODO check bcompleted for validity or undefined

                    oLogger.info("value of complete promise return:" + bcompleted);
                } catch (error) {
                    this.showErrorMessage("Error in completeOrderSfcs:", true);
                }

            } //enfor complete
            // reset all buttons to setbusy false
            oCompleteButton.setBusy(false);
            oValidationButton.setBusy(false);
            oStartOrderButton.setBusy(false);
            // ****************** Complete ends here ********************
        }, //*************** stertOrderEn ends here *********************


        /**
         * startOrderAltEnhanced
         * Marker100
         */
        startOrderAltEnhanced: async function (tevt) {
            // TODO: enclose in try catch 

            //make sure there is a selection in the Worklist
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("No Selection is found");
                return;
            }
            var selection = this.getPodSelectionModel().getSelections();
            if (selection.length > 1) {
                this.showErrorMessage("Please make a single Selection Only");
                return;
            }

            var oValidationButton = this.getView().byId("ValidateCompType");
            var oStartOrderButton = this.getView().byId("OrderStartType");
            var oCompleteButton = this.getView().byId("CompletComp");
            //var sfcUrl =this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/start?async=false";
            var sfcplant = this.getPodController().getUserPlant();
            var sfcOperation = this._getWorkListSelectedOperationGlb(); //gloal ch..ch..
            var sfcResource = this.getView().getModel().getProperty("/resource");
            //var sfcResource = this.getPodSelectionModel().getResource().getResource();

            //Validate resource status marker2000 

            var resStatus = await this.bValidateResForStart(sfcResource, sfcplant);

            if (!resStatus) {
                this.showErrorMessage("Resource status is not appropriate for Start");
                return;

            }

            var oconfig = this.getConfiguration();
            //check to see if PRT should be checked first
            let validatePRT = this.getView().getModel().getProperty("/checkPrt");
            if (validatePRT) {


                /********************* Check PRT ****************************/
                try {
                    let prtval = await this.prtLoadingValidation();

                    // Make sure that prtval is valid and accommodate a prt api failure
                    if (prtval === null || prtval === undefined || prtval.validationResult !== "PRT_PASSED") {
                        let errorMessage = "Tool validation failed.";
                        this.showErrorMessage(errorMessage);
                        return;
                        //throw new Error({Error:"Tool validation failed"});
                    }


                } catch (error) {
                    // Handle the error here
                    //let errorMessage = "An error occurred during tool validation: " + error.message;
                    //this.showErrorMessage(errorMessage);
                    //throw error;
                    let errorMessage = "Tool validation failed.";
                    this.showErrorMessage(errorMessage);
                    return null;

                }
                //end check prt
            }

            //TODO this is not the correct button change
            oStartOrderButton.setBusy(true);
            //Marker6
            try {
                var oWorkListData = await this.getWorkflexlistDataSelectedOrder();
            } catch (error) {
                oLogger.info(`getWorkflexlistDataSelectedOrder: Error : ${error}`);
                throw error;
            }
            //marker9
            // get all Sfcs from the result of the getWorklistDataSelectedOrder;
            var bwfail = oWorkListData || false;
            if (!bwfail){
                this.showErrorMessage("Data Error contact customer Support");
                return;
            }
            var allSfcs = oWorkListData[0].orderSfcs;
            oLogger.info(`we have ${allSfcs.length} number of Sfcs`);

            // //Get all the sfcs in the order AltEnhanced

            try {
                var sfcsReadyToStart = await this.filterStartableSFCsAlt(allSfcs,sfcOperation);
                oLogger.info(`list of sfcs that are startable frm filterStartableSFCsAlt is ${sfcsReadyToStart}`);


            }
            catch (error) {
                oLogger.info(` ${error} from filterStartableSFCsAlt`);
            }
            oLogger.info("sfcs found in Order  " + sfcsReadyToStart.length);

            var vlength = sfcsReadyToStart.length;
            // if vlength === 0 the API call to start will be bypassed
            //Start the loop going through all the chunck of sfcs
            if (vlength === 0) {
                this.showErrorMessage("All SFCs currently are Active for selected Order and cannot be started.");
                return;
            }
            var sfcstocomplete = [];
            var sfcstocompletelength = 0;
            if (!vlength === 0) {
                // Assume that the sfc's will be started
                // so the completesfc will take the value of sfctostart
                // which after the start will have status of ACTIVE
                sfcstocomplete = sfcstostart;
            } else {
                //TODO this will fail if sfcs are have status on HOLD etc
                sfcstocomplete = sfcsReadyToStart;
                sfcstocompletelength = allSfcs.length;
            }
            //bypass this loop if VALIDATE or COMPLETE
            /**go through a loop with step SFCS_CHUNK to start all sfcs */
            oStartOrderButton.setBusy(true);
            for (let i = 0; i < vlength; i += SFCS_CHUNK) {


                let startSFCChunk = sfcsReadyToStart.slice(i, i + SFCS_CHUNK);


                /** API Call to start all SFCS************** *********/
                try {
                    var chunckStartd = await this.startAllSfcs(
                        sfcOperation,
                        sfcplant,
                        sfcResource,
                        startSFCChunk
                    );
                } catch (error) {
                    this.resetButtonsWrkfl();
                    throw error;
                }

                //var isfail = (typeof chunckStartd ==='undefined')? true: false;

                //this.showErrorMessage((typeof chunckStartd === 'undefined'),true);
                //if (isfail){
                //   oStartOrderButton.setBusy(false);
                //}
                //delay for 1s give the gateway chance to cope

                if (vlength > SFCS_CHUNK) {
                    // only if we have multiple CHUNKS
                    let mfactor = Math.ceil((vlength - SFCS_CHUNK) / 1000);
                    let tdelay = 1000 * mfactor;
                    var waitfor = await this.delay(tdelay);
                }


            } //for loop
            this.showErrorMessage("Order Started ", true);
            /****************** End of  LOOP to startall sfcs ***********/
            //this.showErrorMessage("Order Started",true);
            oStartOrderButton.setBusy(false);

            if (!oconfig.executefullFlowVisible) {
                //return the started SFC's
                return "NoValidation";
            }
            //************* Validation starts here ********************

            //TODO check to see if components for this set of sfcs , operation , resource ,plant 
            // are already validated - bypass validation if true and go straight to complete.
            // if the validation has failed then either redo the validation or do not complete and exit.


            oValidationButton.setBusy(true);
            try {
                //get the components for sfc the functions looks at the selected sfc
                //marker11
                var theComponents = await this.getComponentsForSfc();
            } catch (error) {
                this.showErrorMessage("An error was detected:getComponentsForSfc ", true);
                this.resetButtonsWrkfl();
            }

            // tranform theComponents into single row array with just the component
            var tranformedComponents = this.transformComponentData(theComponents);
            var uniqueComponents = [...new Set(tranformedComponents)];
            //vet the components against the classificaton entry
            var vetted = await this.vetComponentsToValidate(uniqueComponents);

            if ((typeof vetted === 'undefined')) {
                //This is wrong masking the problem but is only for debug purposes.
                // also it might not be a problem and all components 
                // were excluded in the Vetting with Classification filters.
                vetted = "";
                this.showErrorMessage("There are not components to Validate", true);
            }
            oLogger.info(" vetted= " + vetted);

            //now create a table Model only with the vetted components
            // and put it into the View Model
            // in case is the vetted array is empty it means to bypass
            // the validation
            if (vetted.length !== 0) {
                var componetsModel = this.ComponentAPISucsess(theComponents, vetted);

                try {
                    var theDialog = await this.openValidateDialog();
                    console.log("theDialog=" + theDialog);
                    oValidationButton.setBusy(false);
                    if (theDialog !== COMPONENT_VALIDATION_SUCCESS) {
                        //set a valid state first
                        oValidationButton.setBusy(false);
                        oCompleteButton.setBusy(false);
                        oStartOrderButton.setBusy(false);
                        //TODO recheck this needs to throw exception or
                        // return and set the ValidationDone in the model to false.
                        this.getView().getModel().setProperty("/validationDone", false);
                        return;
                    } else {
                        this.getView().getModel().setProperty("/validationDone", true);
                        this.showSuccessMessage("Validation passed", true);

                    }
                } catch (error) {
                    this.showErrorMessage("An error was detected: openValidateDialog() ", true);
                    this.resetButtonsWrkfl();

                }
            } // if (vetted)
            else {
                this.resetButtonsWrkfl();
            }

            oCompleteButton.setBusy(true);
            //****** Validation  ends here ******************************

            //****** Complete starts here *******************************
            //do we need to check for Validation Done here ?
            //Now start the loop to complete all sfcs
            for (let i = 0; i < sfcstocompletelength; i += SFCS_CHUNK) {

                try {
                    let startSFCChunk = sfcstocomplete.slice(i, i + SFCS_CHUNK);
                    var bcompleted = await this.completeOrderSfcs(startSFCChunk);
                    //TODO check bcompleted for validity or undefined

                    oLogger.info("value of complete promise return:" + bcompleted);
                } catch (error) {
                    this.showErrorMessage("Error in completeOrderSfcs:", true);
                }

            } //enfor complete
            // reset all buttons to setbusy false


            oCompleteButton.setBusy(false);
            oValidationButton.setBusy(false);
            oStartOrderButton.setBusy(false);
            if (bcompleted) {
                this.showSuccessMessage("Order Completed for current operation", true);
            }
            // ****************** Complete ends here ********************
        },

        /**
         * filterSFCsOnHold
         * find all sfcs that are on hold
         * Marker515
         */

        filterSFCsonHold: async function (allsfcsinorder) {
            var onHoldSFCS = [];
            var promises = allsfcsinorder.map(item => {
                return new Promise((resolve, reject) => {

                    //check if is on Hold: criterion is that the sfc code  is SFCS_ONHOLD
                    var isOnHold = false;
                    if (item.status.code == SFCS_ONHOLD) {
                        isOnHold = true;

                    }

                    if (isOnHold) {
                        onHoldSFCS.push(item.sfc);
                    }
                    resolve();
                });
            });
            try {
                await Promise.all(promises);
                return onHoldSFCS;
            } catch (error) {
                oLogger.info(`${error} from filterSFCsonHold `); // Log any errors
                throw error;
            }

        },



        /**
         * filterStartableSFCSAlt
         * @param {*} allsfcsinorder an array of Sfcs in the format returned from ssfcs=getWorklistDataSelectedOrder().orderSfcs
         * @returns and array of all startable sfcs - takes care of not including sfcs that belong to different operation ,resource , and 0 in inQueue value.
         * 
         * Do we need to make sure all startAble SFCs are in the same operation ?
         */

        filterStartableSFCsAlt: async function (allsfcsinorder,op) {
            var startableSFCS = [];
            var promises = allsfcsinorder.map(item => {
                return new Promise((resolve, reject) => {

                    //check if startable : criterion is that the sfc code  is new or - in queue and quantity in Queue must be > 0.
                    var isStartable = false;
                    if (item.status.code == SFCS_NEW) {
                        isStartable = true;

                    }
                    else {
                        //is in Queue but not certain which operation
                        if (item.status.code == SFCS_INQUE && (item.quantityInQueue > 0)) {
                            if (op) {
                                //
                                //get the steps (Array)
                                var steps = item.steps;
                                //match the op in the steps array
                                //after the match check for inWork and Done to see if we really are in the same operation
                                let oMatch = steps.find(step => step.operation.operation === op);
                                if (oMatch) {
                                    //we found our operation check if inQueue
                                    isStartable = (oMatch.quantityInQueue > 0);
                            } //if (op)
                            
                            
                        }
                    }
                }
                    // var isStartable = (item.status.code  == SFCS_NEW) || (item.status.code == SFCS_INQUE ) && item.quantityInQueue > 0);

                    if (isStartable) {
                        startableSFCS.push(item.sfc);
                    }
                    resolve();
                });
            });
            try {
                await Promise.all(promises);
                return startableSFCS;
            } catch (error) {
                oLogger.info(`${error} from filterStartableSFCsAlt `); // Log any errors
            }
        }, //end filterStartableSFCSAlt



        /**
         * filterActiveSFCSAlt
         * @param {*} allsfcsinorder an array of Sfcs in the format returned from ssfcs=getWorklistDataSelectedOrder().orderSfcs
         * @returns and array of all startable sfcs - takes care of not including sfcs that belong to different operation ,resource , and 0 in inQueue value.
         * 
         */

        filterActiveSFCsAlt: async function (allsfcsinorder, op) {
            var activeSFCS = [];
            var promises = allsfcsinorder.map(item => {
                return new Promise((resolve, reject) => {

                    //check if active : criterion is that the sfc code  is ACTIVE.
                    var isActive = false;
                    if (item.status.code == SFCS_ACTIVE) {
                        isActive = true;
                        //Marker333
                        if (op) {
                            //get the steps (Array)
                            var steps = item.steps;
                            //match the op in the steps array
                            //after the match check for inWork and Done to see if we really are in the same operation
                            let oMatch = steps.find(step => step.operation.operation === op);

                            if (oMatch) {
                                console.log(oMatch);
                                //we found the Object that matches the operation
                                // Now we want to verify that this is on the selected operation or
                                // Some other operation so we would check if is inWork to verify that.

                                if (oMatch.quantityInWork) {
                                    isActive = true;
                                } else {
                                    isActive = false; // Not in work in the selected operation.
                                }
                            }
                            else {
                                console.log("match for operation not found!");
                                isActive = false;
                            }
                        }
                    }


                    if (isActive) {
                        activeSFCS.push(item.sfc);
                    }
                    resolve();
                });
            });
            try {
                await Promise.all(promises);
                return activeSFCS;
            } catch (error) {
                oLogger.info(`${error} from filterActiveSFCsAlt `); // Log any errors
            }
        }, //end filterActiveSFCSAlt

        /**
         * filterInQueueSFCsAlt
         * @param {*} allsfcsinorder an array of Sfcs in the format returned from ssfcs=getWorklistDataSelectedOrder().orderSfcs
         * @returns and array of all  sfcs in queue - takes care of not including sfcs that belong to different operation ,resource , and >0 in inQueue value.
         * 
         *  We need to make sure all inQueue  SFCs are in the same operation 
         * quantitity in queue > 1
         * also we need to make sure that all sfcs have the same routing as the selected sfc
         * if the parameter irouting is not passed then it does not enforce the condition of the same 
         * routine for all the sfcs inQueue
         */

        filterInQueueSFCsAlt: async function (allsfcsinorder, irouting) {
            var inQueueSFCS = [];
            var promises = allsfcsinorder.map(item => {
                return new Promise((resolve, reject) => {

                    //check if inQueue : criterion is that the sfc code  is in queue and quantity in Queue must be > 0.
                    var isInQueue = false;
                    console.log(typeof item.status.code); // Check if this logs 'number' or 'string'
                    console.log(typeof SFCS_INQUE); // Check if this also logs 'number' or 'string'


                    if (irouting) {
                        var bSamerouting = (item.routing.routing == irouting);
                    } else {
                        bSamerouting = true;

                    }
                    //check for SFCS_INQUE , quantityInQueue >0 and also bSameRouting which is true or false depending
                    // if the item.routing == irouting the passed parameter
                    // it the paramter irouting  is not passed then the  bSameRouting value is always true which means 
                    // we bypass routing checking.
                    // excluding sfcs that are not in the same routing as the selected sfc seems is required by the merge API.

                    if (item.status.code == SFCS_INQUE && (item.quantityInQueue > 0 && (bSamerouting))) {
                        
                        isInQueue = true;

                    } else {
                        isInQueue = false;
                    }



                    //if (item.status.code == SFCS_INQUE && (item.quantityInQueue > 0)) {
                    //   isInQueue = true;
                    //   
                    //}
                    //else {
                    //    isInQueue = false;
                    //}

                    if (isInQueue) {
                        inQueueSFCS.push(item.sfc);
                    }
                    resolve();
                });
            });
            try {
                await Promise.all(promises);
                return inQueueSFCS;
            } catch (error) {
                oLogger.info(`${error} from filterInQueueSFCsAlt  `); // Log any errors
            }
        }, //end filterInQueueSFCsAlt




        /**
         * onValidateComponentsEn
         */

        onValidateComponentsEn: async function () {

            //TODO wrap around a try catch 
            // this way there will be a valid valres
            // or an exception which will be handled in the 
            // catch 

            var valres = await this.validateComponentsEnhanced();
            if ((typeof valres === 'undefined')) {
                valres = "undefined - no components to validate";
            }

            oLogger.info("value of validateComponentEn= " + valres);
            this.resetButtonsWrkfl();

        },


        /**
        * validateComponentsEnhanced (assumes valid selection Model)
        * @returns 
        */
        /** StandAlone validaton Dialog
         *  validateComponentsEnhanced
         * 
         */
        validateComponentsEnhanced: async function () {
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("No selection was found");
                //TODO throw exception first 
                return;
            }

            var selection = this.getPodSelectionModel().getSelections();
            if (selection.length > 1) {
                this.showErrorMessage("Please make a single Selection Only");
                return;
            }



            var oValidationButton = this.getView().byId("ValidateCompType");
            var oStartOrderButton = this.getView().byId("OrderStartType");
            var oCompleteButton = this.getView().byId("CompletComp");

            oValidationButton.setBusy(true);

            try {
                var theComponents = await this.getComponentsForSfc();
            } catch (error) {
                this.showErrorMessage("An error was detected: " + error.message, true);
                this.resetButtonsWrkfl();
                //TODO either return or rethrow the exception
            }

            // tranform theComponents into single row array with just the component
            // TODO might be better to make this async and use await  just in case we have side effects

            var tranformedComponents = this.transformComponentData(theComponents);
            //remove any duplicate Components
            var uniqueComponents = [...new Set(tranformedComponents)];

            //vet the components against the classificaton entry  Marker3
            // TODO wrap around try catch 
            try {
            var vetted = await this.vetComponentsToValidate(uniqueComponents);
            oLogger.info(" vetted= " + vetted);
            } catch (oError){
                this.showErrorMessage("failed vetting components",true);
                throw oError;
            }

            //now create a table Model only with the vetted components
            // and put it into the View Model
            // in case is the vetted array is empty it means to bypass
            // the validation
            if ((typeof vetted === 'undefined')) {
                //This is wrong masking the problem but is only for debug purposes.
                vetted = "";
                this.showErrorMessage("There are no components to Validate", true);
            }
            if (vetted.length !== 0) {
                var componetsModel = this.ComponentAPISucsess(theComponents, vetted);

                try {
                    var theDialog = await this.openValidateDialog();
                    console.log("theDialog=" + theDialog);
                    oValidationButton.setBusy(false);
                    if (theDialog !== COMPONENT_VALIDATION_SUCCESS) {
                        //set a valid state first
                        oValidationButton.setBusy(false);
                        oCompleteButton.setBusy(false);
                        oStartOrderButton.setBusy(false);
                        this.showErrorMessage("Validation has failed", true);
                        //set validaton not done , for standalone complete to check
                        this.getView().getModel().setProperty("/validationDone", false);

                        //TODO throw exception and return status = "VALIDATION_FAIL"

                        return;
                    }
                    else {
                        //if this is a standalone then we need to store the state of 
                        //the validation.
                        //set validaton not done , for standalone complete to check
                        this.getView().getModel().setProperty("/validationDone", true);
                    }

                } catch (error) {
                    this.showErrorMessage("An error was detected in Validation Dialog ", true);
                    this.resetButtonsWrkfl();
                    this.getView().getModel().setProperty("/validationDone", false);

                }
            } // if (vetted)
        },

        /**
         * createValidationStatus
         */

        createValidationStatus: async function () {
            try {
                var vResult = await new Promise((resolve, reject) => {
                    //set the values here
                    // marker12
                    var selection = this.getPodSelectionModel().getSelections();
                    var thesfc = selection[0].getSfc().getSfc();

                    vstatus = {
                        plant: this.getPodController().getUserPlant(),
                        resource: this.getView().getModel().getProperty("/resource"),
                        operation: this._getWorkListSelectedOperationGlb(),
                        sfc: thesfc,
                        validated: false

                    };
                    resolve(vstatus);
                });

                return vResult;
            } catch (error) {

                this.showErrorMessage("failed to create validation Status");
                throw error;
            }
        },

        /**
         * createVStatusStore
         * @returns the created Validation status object
         * 
         */
        createVStatusStore: function () {
            var oValidations = [];
            return {
                addValidationStatus: async function () {
                    var nValidation = await this.createValidationStatus();
                    if (oValidations.length >= VSTORE_LIMIT) {
                        oValidations.shift();
                    }
                    oValidations.push(nValidation);
                },
                searchValidationStatus: function (propertyName, value) {
                    return oValidations.filter(vstatus => vstatus[propertyName] === value);
                }
            }
        },

        //marker8
        /**
         * onTestFunction
         * temporary to work out the getWorklistDataSelectedOrder
         * eventually will become its own buton StartOrder Enhanced 
         * @param {*} evt 
         */
        onTestFunction: async function (evt) {
            try {
                //Do we need to test here for valid state with selection?
                var oAlt = await this.startOrderAltEnhanced(evt);

            } catch (error) {
                var sErr = `Error in StartOrderAltEnhanced : ${JSON.stringify(error)}`;

            }


        },

        /**
         * signOffAllSfcsOrderOperation
         * @param {*} eOrder 
         * @param {*} tevt 
         * @returns 
         * this function looks at the order and the selected operation
         * and all the sfcs in the order. 
         * then it filter all the valid active sfcs in the operation.
         * then it calls signOff API that if the number of sfcs is large 
         * // it loop though in smaller chunks 
         * 
         */

        signOffAllSfcsOrderOperation: async function (eOrder, tevt) {
            //marker5
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("No selection");
                return;
            }
            if (!eOrder) {
                this.showErrorMessage("Order must be provided");
                return;
            }
            tevt.getSource().setBusy(true);
            // Marker5000
            //TODO do we need to call getAllSfcsInOrder all the time?
            // see if we can get it from the model 
            // even more see if we can get all started sfcs
            // We need to substitue this call to 
            // allSfcs = await this.
            try {
                var oWorkListData = await this.getWorklistDataSelectedOrder(eOrder);
                var allSfcs = oWorkListData[0].orderSfcs
                console.log(allSfcs);

            } catch (oError) {

            }

            oLogger.info("sfcs found in Order  " + allSfcs.length);


            // use this.filterActiveSFCSAlt Marker3000
            var iOperation = this._getWorkListSelectedOperationGlb();
            var thesfcs = await this.filterActiveSFCsAlt(allSfcs, iOperation);

            if ((typeof thesfcs === 'undefined') || thesfcs.length === 0) {
                this.showErrorMessage("No Sfcs to signoff ", true);
                tevt.getSource().setBusy(false);

                // we have nothing else to do
                return;
            }
            oLogger.info("active sfcs found  " + thesfcs.length);
            for (let i = 0; i < thesfcs.length; i += SFCS_CHUNK) {

                var partofthesfcs = thesfcs.slice(i, i + SFCS_CHUNK);
                //TODO add a try catch here

                var signedoff = await this.signOffSfcs(partofthesfcs);
                var waitfor = await this.delay(1000);
            }

            tevt.getSource().setBusy(false);
            this.showSuccessMessage("Signoff Completed.", true);

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
                console.log("signoff has failed!! line 1126"); // Log any errors
            }
        },

        getSfcStatusIsActive: async function (thesfc) {
            try {

                var oResponseData = await this.getSfcStatus(thesfc);
                var code = oResponseData.status.code;
                var sfcsWithCodeActive = (code == SFCS_ACTIVE) ? oResponseData.sfc : "";
                var goodActive = (code == SFCS_ACTIVE) ? true : false;
                // we want to push this to the model
                // console.log("status code="+code);
                var tm = this.getView().getModel().getProperty("/activeSFCs");
                if (goodActive) {
                    tm.push(sfcsWithCodeActive);
                    this.getView().getModel().setProperty("/activeSFCs", tm);
                    //this._debugGlb("Setting tm in the model after validate called", tm);
                }
                var result = tm;
                return goodActive;
            }
            catch (error) {
                oLogger.info("Error in the catch of getSfcStatusActive");
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

        /**
         * 
         * transformComponentData: function (oResponseData) 
         * 
         * @param {*} oResponseData this is the return from
         * the call to getComponets that is an array of multiple columns
         * @returns an array with the components (the column 0 of the passed param)
         */

        transformComponentData: function (oResponseData) {
            var result = oResponseData;
            var justthecomponentArr = [];
            for (let i = 0; i < result.length; i++) {

                justthecomponentArr.push(result[i].component);
            }
            this.getView().getModel().setProperty("/justcomponentslist", justthecomponentArr);
            return justthecomponentArr;
        },

        /**
         * ComponentAPISucsess
         * @param {*} oResponseData ther Response from the 
         *                      "/assembly/v1/plannedComponents"
         * @returns componentModel --also sets the table model /components
         * 
         */

        ComponentAPISucsess: function (oResponseData, vettedComponents) {
            var result = oResponseData;
            var componentmodel = {
                components: [],
                ndcomponents: []

            };
            var arrWorking = vettedComponents;
            var indexVetted=0;
            var ivettedlength = vettedComponents.length;

            for (let i = 0; i < result.length; i++) {
                //check first if the component if is vetted
                //if not skip it.
                var rowColumn0 = result[i].component;
               
                
                 
                if (arrWorking.includes(rowColumn0)) {
                    //move to the next component in the vettedComponents
                        arrWorking=arrWorking.filter(element => element !==rowColumn0);
                        if (arrWorking.length ===0){
                            break;
                        }

                    //push with masked with asterics apart from the first 4 chars
                    let unmasked = result[i].component;
                    //let masked = '*'.repeat(3)+unmasked.slice(3);
                    let masked = unmasked.slice(0, -3) + "***";
                    componentmodel.components.push(
                        { component: masked, description: result[i].componentDescription, validated: "N" }
                    );
                    //componentmodel.components.push(
                    //    { component: result[i].component, description: result[i].componentDescription, validated: "N" }
                    //);
                    //push the actual non display
                    componentmodel.ndcomponents.push(
                        { component: result[i].component, description: result[i].componentDescription, validated: "N" }
                    );
                }
            }
            // put the table model into the View Model
            this.getView().getModel().setProperty("/components", componentmodel.components);
            this.getView().getModel().setProperty("/noDisplayComponents", componentmodel.ndcomponents);
            return componentmodel;
        },

        ComponentAPIError: function (oError, sHttpErrorMessage) {
            this.showErrorMessage(oError + "  " + sHttpErrorMessage, true);
        },


        startAllSfcsWorkflow: async function (order) {
            oLogger.info("start all sfcsworkflow clicked");
        },


        /**
         * resetButtonsWrkfl 
         * resets all buttons to active 
         */
        resetButtonsWrkfl: function () {
            var oValidationButton = this.getView().byId("ValidateCompType");
            var oStartOrderButton = this.getView().byId("OrderStartType");
            var oCompleteButton = this.getView().byId("CompletComp");
            var oSignoffButton = this.getView().byId("SignoffComp");

            //var oLabelStatus= this.getView().byId("StatusFlowType");
            oCompleteButton.setBusy(false);
            oValidationButton.setBusy(false);
            oStartOrderButton.setBusy(false);
            oSignoffButton.setBusy(false);
            //oLabelStatus.setText("Process status ..idle");
        },

        /**
         * onValidateComponent
         * 
         * Marker500
         */

        onValidateComponent: function () {
            var oTable = this.byId("Vcomp");
            var oInput = this.byId("componentInput");
            var sValue = oInput.getValue();
            var shadowTableModel = this.getView().getModel().getProperty("/noDisplayComponents");
            var selectionStatus = this.byId("msgcustid");


            //Clear the input box 
            oInput.setValue("");


            var aItems = oTable.getItems();
            var bFound = false;
            var selectedItems = 0;
            var lastFoundIndex = 0;
            var lastselectedComponent = "";

            for (var i = 0; i < aItems.length; i++) {
                var shadowItem = shadowTableModel[i];
                var oItem = aItems[i];
                var oCells = oItem.getCells();
                var shadowCell = shadowItem.component;

                //if (oCells[0].getText() === sValue) {
                if (shadowCell === sValue) {
                    bFound = true;
                    lastFoundIndex = i;
                    //lastselectedComponent=oCells[0].getText();
                    lastselectedComponent = sValue;
                    oCells[2].setText("Y");

                    oItem.addStyleClass("markFound"); // Add a CSS class to change the color of the row
                    sap.ui.getCore().applyChanges

                    break;
                }
            }

            if (!bFound) {

                this.showErrorMessage("Component Not found -- Validation failed");
                //this._oDialog.close();
                //this._oResolve(0); // Resolve the Promise with 0
            } else {
                var bAllChecked = aItems.every(function (oItem) {
                    if (oItem.getCells()[2].getText() === "Y") {
                        selectedItems++;
                    }
                    return (oItem.getCells()[2].getText() === "Y");
                });

                let nFindSelectedItemCount = 0;
                aItems.forEach(item => {
                    if (item.getCells()[2].getText() === "Y") {
                        nFindSelectedItemCount++;
                    }
                });



                selectionStatus.setText(`${nFindSelectedItemCount} out of ${aItems.length} validated  `);
                //selectionStatus.setText(`${nFindSelectedItemCount} out of ${aItems.length} validated ---- last validated: ${lastselectedComponent} `);


                if (bAllChecked) {
                    this._oDialog.close();
                    this._oResolve(1); // Resolve the Promise with 1
                }
            }
        },

        /***
         * 
         * openValidateDialog
         *   name: "illumiti.ext.viewplugins.exampleViewPlugin.view.ComponentValidation",
         *  name: "llumiti.ext.viewplugins.exampleViewPlugin.view.ComponentValidationStaticHeader"
         */

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
                        //handle the user hitting escape
                        this._oDialog.setEscapeHandler(function (oPromiseResolution) {
                            console.log("Escape key was pressed");
                            this._oDialog.close();
                            this._oDialog.destroy();
                            this._oDialog = null;
                            oPromiseResolution.resolve();
                            resolve(-1); // Resolve the Promise with -1 if the dialog was closed with the Escape key
                        }.bind(this));

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

        /**
         * onValDEscape
         */
        onValDEscape: function (e) {
            e.resolve(-1);
            var oValidationButton = this.getView().byId("ValidateCompType");
            oValidationButton.setBusy(false);
        },


        /**
         * onValidatePressedx
         * 
         * Gets the user input from the validation text box
         * compares the shadow list ( the display list has asteriscs)
         * With the user inpup
         * if there is a match it marks it , changes the color
         * of the line item to green
         * if no match then it gives an error message and if ready for 
         * further input. If all the components are matched then it exits
         * with success for the validation
         * if the ESC key is pressed then it exits with validatio failure.
         * @param {
         * } evt Event is ignored
         * @returns 
         */
        onValidatePressedx: function (evt) {
            var howManyMatched = 0;
            this.showSuccessMessage("Validate button pressed");
            var scannedOrEntered = this.byId("componentInput").getValue();
            var oTable = this.byId("Vcomp");
            var nRows = oTable.getItems();
            if (scannedOrEntered) {
                for (var i = 0; i <= nRows.length; i++) {

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
                    this.byId("dcomponentValidator").close();
                    this.byId("dcomponentValidator").destroy();
                    return "Success";
                } else if (0) { // Replace this with your condition to check if the user aborts
                    // Close the dialog and return an abort value
                    this.byId("dcomponentValidator").close();
                    this.byId("dcomponentValidator").destroy();
                    return "Abort";
                }
            } else {
                //TODO How do we react here?

            }
        },

        /**
         * completeSfcs();
         *  expects there is a selection in the selection model
         * and an array with with the sfc(s) to complete
         */

        //TODO refactor using  the getWorklistDataSelectedOrder 
        completeSfcs: async function () {
            if (!this.bCheckSelectionModel()) {
                this.showErrorMessage("No Order is selected");
                return;
            }
            var oCompleteButton = this.getView().byId("CompletComp");

            //check for validation has happened
            let valdone = this.getView().getModel().getProperty("/validationDone");
            if (valdone === false) {
                this.showErrorMessage("No validation  Done ");
                return;

            }

            oCompleteButton.setBusy(true);
            //Marker
            //TODO put into try catch block
            var eOrder = this.getView().byId("OrderValueLabel").getText();
            var allSfcs = await this.getAllSfcsInOrder(eOrder);
            var sfcstocomplete = await this.filterActiveSFCS(allSfcs);
            var clength = sfcstocomplete.length;
            if (clength === 0) {
                this.showErrorMessage("SFC Not Active");
                this.resetButtonsWrkfl();

                return;
            }
            //Unsure if the status is alredy true and calling again to set to true
            //so for good measure set to false first.
            oCompleteButton.setBusy(false);
            oCompleteButton.setBusy(true);

            for (let i = 0; i < clength; i += SFCS_CHUNK) {
                let completeSFCChunk = sfcstocomplete.slice(i, i + SFCS_CHUNK);

                try {
                    var oComplete = await this.completeOrderSfcs(completeSFCChunk);
                } catch (error) {
                    this.showErrorMessage("Sfc complete failed ");
                    this.resetButtonsWrkfl();
                    return;

                }
            }
            //this.showSuccessMessage("completeDone.",true);
            this.showSuccessMessage("Order Completed for current operation", true);
            oCompleteButton.setBusy(false);
            return oComplete;
        },


        onCompleteOrderSfcs: function (evt) {
            this.completeSfcs();
        },




        /**
         * 
         * loadModel
         * 
         * loadModel aggregates all the needed info from the POD and selections
         * and then it sets the model for the view.
         * 
         */

        loadModel: function () {
            //get the view in oView 
            var oView = this.getView();
            var oPodController = this.getPodController();
            //get configuration as set in the POD designer 
            var oConfiguration = this.getConfiguration();
            //hide the buttons that are set as hidden from the POD designer configuration.
            // TODO move this outside the LoadModel since we only need to set this once
            // but loadModel is called multiple times.

            var oValidationButton = this.getView().byId("ValidateCompType");

            var oStartOrderButton = this.getView().byId("TestFunction"); //full flow
            var oStartSerializeButton = this.getView().byId("SSFCQuantityId");



            var oCompleteButton = this.getView().byId("CompletComp");
            var oSignoffButton = this.getView().byId("SignoffComp");
            var splitButton = this.getView().byId("SplitSfcid"); //split/relabel
            var relabelButton = this.getView().byId("RelableSfcid");
            var oSfcDoneButton = this.getView().byId("SfcDoneId");


            oCompleteButton.setVisible(oConfiguration.completeButtonVisible);
            oSignoffButton.setVisible(oConfiguration.signoffButtonVisible);
            oValidationButton.setVisible(oConfiguration.validateButtonVisible);
            splitButton.setVisible(oConfiguration.splitSFCVisible);
            relabelButton.setVisible(oConfiguration.relabelSFCVisible);
            var checkPrtValue = oConfiguration.checkPrt;
            var laborOn = oConfiguration.laborEnabled;
            oStartOrderButton.setVisible(oConfiguration.StartOrderVisible);
            oStartSerializeButton.setVisible(oConfiguration.startOrderSerializeVisible);
            oSfcDoneButton.setVisible(oConfiguration.sfcDoneVisible);




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
            var oPstatus = "  Process status ..idle";

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
                pstatus: oPstatus,
                wrklstrows: wrklstcurrentsel,
                material: "",
                startableSFCs: [],
                activeSFCs: [],
                components: [],
                noDisplayComponents: [],
                validatedComponents: [],
                validationStatuses: [],
                uniqueCurrentSelection: uniqueCSel,
                curSelections: [],
                numberOfOperators: 0,
                validationDone: false,
                checkPrt: checkPrtValue,
                uniqueSel: wrklistuniquesel,
                labor: laborOn
            };
            if (Object.keys(oModelData.uniqueCurrentSelection).length !== 0) {
                oModelData.orderselect = oModelData.uniqueCurrentSelection.shopOrder;
                oModelData.operation = oModelData.uniqueCurrentSelection.operation;
            }
            //TODO remove the code below is superflows.
            if (aOperations.length === 1) {
                oModelData.operation = aOperations[0].operation;
            }

            var oModel = new JSONModel(oModelData);
            oModelData.material = aInputs.length ? aInputs[0].material : "";
            oView.setModel(oModel);
        },

        /*--------------------------------------------------------

         * This enables receiving Notification messages in the plugin 
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

