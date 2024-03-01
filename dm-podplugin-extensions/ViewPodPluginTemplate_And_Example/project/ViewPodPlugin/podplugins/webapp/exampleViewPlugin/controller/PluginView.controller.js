
sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/base/Log"
], function (JSONModel, Fragment, PluginViewController, Log) {
    "use strict";

    var oLogger = Log.getLogger("exampleExecutionPlugin", Log.Level.INFO);
    //------------------------------------------------------------------------
    //  add a wrklstcurrentsel to receive the selected row on the worklist 
    // (this is includes Operation that is missing from the selectionModel for some reason)
    //  this will be global var in this POD context
    // this object is updated everytime that the selection on the worklist is changed
    // the loadModel  is updated to merge this object into the model in the view

    var wrklstcurrentsel = {}, wrklstsopersel = "notset";
    var glbStack = [];

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
        },

        onAfterRendering: function () {
            console.log('after Rendering');
        },

        onPodSelectionChangeEvent: function (sChannelId, sEventId, oData) {

            // don't process if same object firing event
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }

            this.loadModel();
        },

        onOperationChangeEvent: function (sChannelId, sEventId, oData) {
            var p = 10; //just to put a breakpoint
            //oLogger.info("onOperationChangeEvent: " + JSON.stringify(oData));
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
            wrklstsopersel = oData.selections[0].operation ? oData.selections[0].operation : "non";
            glbStack.push(wrklstsopersel);

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
        _debugGlb: function (m) {

            // It seems we are getting circular references exceptions when trying to JSON.stringy the model so catch the
            // exception so that the plugin does not fail , this is a debug function so is ok
            try {
                if (m) {
                    oLogger.info(m + " : " + "Globals->  wrklstcurrentsel: " + "  wrklstsopersel: " + wrklstsopersel);
                } else {
                    oLogger.info("Globals->  wrklstcurrentsel: " + "  wrklstsopersel: " + wrklstsopersel);
                }
            } catch (error) {
                oLogger.info("Error which is (propably circular dependency ):", Error);
            } finally {
                // the statement below gets the the full json model in
                //javascript format.
                var theModel = this.getView().getModel().getData();
            }
        },
        //-------- getStartableSFCS --------------------
        // filter the passed sfcs from the selected order
        // to only sfcs that are appropriate for starting
        // these means only the ones that have status of NEW or InQue
        //-----------------------------------------------------------

        getStartableSFCS: function (plant, sfcstofilter) {
            //for each sfc get the status (getSFCStatus DM API call)
            // if the sfc is inQuew or New 
            // is pushed into startable SFCs array
            // returns the array of startable sfcs

            var startableSFCS = [];
            sfcstofilter.forEach((item, index) => {
                var p=this.getSFCStatus(item);
                if (p) {
                    startableSFCS.push(item);
                }
            });
            return startableSFCS;
        },

        //---------------------- end getStartable SFCS ------

        filterSFs: function (sfcstofilter) {

            var startableSFCS = [];

            var promises = sfcstofilter.map(item => {
                return this.getSFCStatus(item)
                    .then(isStartable => {
                        if (isStartable) {
                            startableSFCS.push(item);
                        }
                    });
            });

            return Promise.all(promises)
                .then(() => {
                    return startableSFCS; // Return startable SFCs once all promises have resolved
                })
                .catch(error => {
                    console.error(error); // Log any errors
                });

        },
        // -- -Alternative getSfcStatus wraps the calls to API in a promise
        // -- and makes it possible to use asyc - wait 
        getSfcStatusAlt: async function (thesfc){
            var theplant=this.getPodController().getUserPlant();
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcdetail";
            var params = {
                plant: theplant,
                sfc: thesfc
            }
            var that = this;

            var oResponseData= await new Promise((resolve , reject) =>{
                that.ajaxGetRequest(sUrl,params, function (oResponseData){
                    var result = oResponseData.status;
                    resolve(result);
                }, function (Error, sHttpErrorMessage){
                    reject(Error);
                });
            });

        },

        // ------------------ End Alternative getSFCStatusAlt --------

        // ------------  getSFCStatus DM Api call ------------

        getSFCStatus: function (thesfc) {
            //we will call sfc/v1/sfc/detail to get the full details of the sfc
            // we will get the status and check for new status will return true or false
            // true if the sfc is inQueue or new ,false if the sfc is Started (active)
            // we need plant and sfc to call the API
            var theplant = this.getPodController().getUserPlant();
            var sUrl = this.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcdetail";
            var params = {
                plant: theplant,
                sfc: thesfc
            }
            var that = this;
            var status = [];
            this.ajaxGetRequest(sUrl, params, function (oResponseData) {
                var dummy1 = 0; //debug breakpoint to check data
                var sfcstatus = oResponseData.status;
                status.push(sfcstatus);
            }, function (oError, sHttpErrorMessage) {
                var dummy2 = 0;  //debug breakpoint to check data
                status.push("ERR");


            });
            return status; //Not really returning anything useful TODO Remove
        },
        // ----- End getSFCStatus -----------------------


        ComponentAPISucsess: function (oResponseData) {
            var result = oResponseData;
            var componentmodel = {
                components:
                    []
            };
            for (let i = 0; i < result.length; i++) {
                 
                componentmodel.components.push(
                    {component:result[i].component,description: result[i].componentDescription,validated:"N"}
                );
                
            } this.getView().getModel().setProperty("/components", componentmodel.components);
        },
        ComponentAPIError: function (oError, sHttpErrorMessage) {
            //TODO do something with the error condition
        },

        //------------------ Start Validate Components --------

        onValidateComponents: function (evt) {
            oLogger.info("onValidateComponent: " + evt);

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
            // Assumes that fragment is in the sam folder as the plugin view

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

            }
        },
        //----------------- End Validate Components ----------

        //----- Lutron Start Order ----------------
        // The StartOrder button was pressed
        // We need to start all the sfc's in the order
        // first call Order API to get all the SFCS for the order
        // filter the sfc only the ones appropriate for starting (remove sfc's that are Active)
        // then call start/sfcs to start all the gathered SFCS
        //
        // and Generalize for use in other plugins.
        // -----------------------------------------

        onStartOrder: function (evt) {
            this._debugGlb("onStartOrder ");

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
            this.setBusy(true);

            //---------------------------- ajaxGetRequest /Orders ------------------
            //get all the sfc in the order calling the order API and extracting sfcs from the response
            this.ajaxGetRequest(
                sUrl,
                oParameters,
                function (oResponseData) {


                    var sfcUrl = that.getPublicApiRestDataSourceUri() + "/sfc/v1/sfcs/start?async=false";
                    var sfcplant = that.getPodController().getUserPlant();
                    var sfcOperation = that._getWorkListSelectedOperationGlb(); //gloabal ch..ch..
                    var sfcResource = that.getPodSelectionModel().getResource().getResource();
                    var sfcSfcs = oResponseData["sfcs"];
                    //filter the sfcs and only use the sfc that are new or inQueue

                    var filteredsfcs = that.getStartableSFCS(sfcplant, sfcSfcs);
                    //TODO when filteredsfcs working substitue the value 
                    // below in the ssfcParameters.sfcs 

                    var ssfcParameters = {
                        plant: sfcplant,
                        operation: sfcOperation,
                        quantity: 1, //TODO find the quantity 
                        resource: sfcResource,
                        sfcs: sfcSfcs //,
                        // processLot:""
                    }
                    that._debugGlb("onStartOrder: before PostRequest ");
                    //--------------------ajaxPostRequest /sfc/v1/sfcs ------------
                    that.ajaxPostRequest(
                        sfcUrl,
                        ssfcParameters,
                        function (oResponseData) {
                            that.showSuccessMessage("Order Started succesfully!", true);
                            //oLogger.info("Orderstart success");

                        },
                        //The error call back for the /sfc/sfcs/start API call
                        function (oError, sHttpErrorMessage) {
                            oLogger.info("Errors - sfc start  " + sHttpErrorMessage);
                            that.showErrorMessage(oError, true);
                        }
                    ); //close parenthesis for the Post call (sfs/sfcs/start)
                },
                //the error callback for the /Order API call
                function (oError, sHttpErrorMessage) {

                    oLogger.info("Errors " + sHttpErrorMessage);
                });

            this.setBusy(false);
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
            //TODO remove the customfields for this Lutron Plugin

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
            }
            // Create the Model in oModelData
            var oModelData = {
                podType: sPodType,
                inputType: oPodSelectionModel.getInputType(),
                workCenter: oPodSelectionModel.getWorkCenter(),
                operation: "",
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
                wrklstrow: wrklstcurrentsel
            };

            if (aOperations.length === 1) {
                oModelData.operation = aOperations[0].operation;
            }
            // add material custom fields to model
            //this.addMaterialCustomFields(oPodController.getUserPlant(), sMaterial);
            //oLogger.info("oModelData.wrllstrow :-> : " + JSON.stringify(oModelData.wrklstrow));
            var oModel = new JSONModel(oModelData);

            // Set the model for the View with the gathered info
            oView.setModel(oModel);
            this._debugGlb("after setModel in the ");
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
                this.byId("closeButton").setVisible(oConfiguration.closeButtonVisible);
            }
        }
    });

    return oPluginViewController;
});


