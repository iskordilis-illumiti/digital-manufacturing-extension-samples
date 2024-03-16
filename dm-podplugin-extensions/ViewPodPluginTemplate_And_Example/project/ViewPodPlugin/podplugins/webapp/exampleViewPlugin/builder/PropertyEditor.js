sap.ui.define([
    "sap/dm/dme/podfoundation/control/PropertyEditor"
], function (PropertyEditor) {
    "use strict";

    var oPropertyEditor = PropertyEditor.extend("illumiti.ext.viewplugins.exampleViewPlugin.builder.PropertyEditor", {
        
        constructor: function (sId, mSettings) {
            console.log("constuctor Property Editor");
            PropertyEditor.apply(this, arguments);
            this.setI18nKeyPrefix("exampleViewPlugin.");
            this.setResourceBundleName("illumiti.ext.viewplugins.exampleViewPlugin.i18n.builder");
            this.setPluginResourceBundleName("illumiti.ext.viewplugins.exampleViewPlugin.i18n.i18n");
        },

        addPropertyEditorContent: function (oPropertyFormContainer) {
            console.log('Property Editor addPropertyEditorContent');
            var oData = this.getPropertyData();
            this.addSwitch(oPropertyFormContainer, "notificationsEnabled", oData);
            this.addSwitch(oPropertyFormContainer, "closeButtonVisible", oData);
            this.addSwitch(oPropertyFormContainer,"validateComponentsVisible",oData);
            this.addSwitch(oPropertyFormContainer,"executeStartOrderOnlyVisible",oData);
            this.addSwitch(oPropertyFormContainer,"executefullFlowVisible",oData);
            
        },

        getDefaultPropertyData: function () {
            var oData = {
                "notificationsEnabled": true,
                "closeButtonVisible": false,
                "validateComponentsVisible": false,
                "executeStartOrderOnlyVisible": false,
                "executefullFlowVisible": true

            };

            return oData;
        }
    });

    return oPropertyEditor;
});