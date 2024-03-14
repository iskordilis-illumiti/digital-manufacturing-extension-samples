sap.ui.define([
    "sap/dm/dme/podfoundation/component/production/ProductionUIComponent"
], function(ProductionUIComponent) {
    "use strict";

    /**
     * Heavily adapted for the Lutron Project (Starting all SFCs in an Order and Validation components and the compolete the Order)
     * This plugin demonstrates a "View" type plugin that accepts "custom"
     * notifications.  The  Property Editor provides a switch that will enable
     * or disable notifications for the plugin.  The view for this plugin
     * displays various object/parameters that is currently defined in the POD
     * Selection Model.  It also provides a text area that will display
     * any the notification messages received from the back end microservice. 
     * Also plugin shows how to call public API to read material custom fields. 
     */
    var Component = ProductionUIComponent.extend("illumiti.ext.viewplugins.exampleViewPlugin.Component", {
        metadata : {
            manifest : "json"
        }
    });

    return Component;
});