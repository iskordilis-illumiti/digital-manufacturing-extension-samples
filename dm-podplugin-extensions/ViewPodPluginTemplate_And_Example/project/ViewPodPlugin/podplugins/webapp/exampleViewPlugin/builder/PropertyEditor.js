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
            //this.addSwitch(oPropertyFormContainer, "notificationsEnabled", oData);
            //this.addSwitch(oPropertyFormContainer, "closeButtonVisible", oData);
            //this.addSwitch(oPropertyFormContainer,"validateComponentsVisible",oData);

            this.addSwitch(oPropertyFormContainer,"StartOrderVisible",oData);
            
            this.addSwitch(oPropertyFormContainer,"executefullFlowVisible",oData);
            this.addSwitch(oPropertyFormContainer,"validateButtonVisible",oData);
            this.addSwitch(oPropertyFormContainer,"completeButtonVisible",oData);
            this.addSwitch(oPropertyFormContainer,"signoffButtonVisible",oData);
           // this.addSwitch(oPropertyFormContainer,"startOrderVisible",oData);
            this.addSwitch(oPropertyFormContainer,"startOrderSerializeVisible",oData);
            this.addSwitch(oPropertyFormContainer,"splitSFCVisible",oData);
            this.addSwitch(oPropertyFormContainer,"relabelSFCVisible",oData);
            this.addSwitch(oPropertyFormContainer,"checkPrt",oData);
            this.addSwitch(oPropertyFormContainer,"sfcDoneVisible",oData);
            this.addSwitch(oPropertyFormContainer,"laborEnabled",oData);

            
            
        },

        getDefaultPropertyData: function () {
            var oData = {
                //"notificationsEnabled": true,
                //"closeButtonVisible": false,
                //"validateComponentsVisible": false,
                "StartOrderVisible": true,
                "executefullFlowVisible": true,
                "validateButtonVisible": true,
                "completeButtonVisible": true,
                "signoffButtonVisible": true,
                //"startOrderVisible" : true,
                "startOrderSerializeVisible":true,
                "splitSFCVisible": true,
                "relabelSFCVisible": true,
                "checkPrt":true,
                "sfcDoneVisible":true,
                "laborEnabled":false


            };

            return oData;
        }
    });

    return oPropertyEditor;
});