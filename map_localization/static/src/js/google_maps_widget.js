odoo.define('map_localization.GoogleMapsWidget', function (require) {
    "use strict";

    const FieldText = require('web.basic_fields').FieldText;
    const fieldRegistry = require('web.field_registry');

    const GoogleMapsWidget = FieldText.extend({
        template: null,

        _renderReadonly: function () {
            this.$el.html('<iframe src="' + this.value + '" width="100%" height="450" frameborder="0" style="border:0;" allowfullscreen="true"></iframe>');
        },

        _renderEdit: function () {
            this.$el.html('<input type="text" class="o_field_char o_field_widget" value="' + this._formatValue(this.value) + '" style="width: 100%;"/>');
        },
    });

    fieldRegistry.add('google_maps', GoogleMapsWidget);

    return GoogleMapsWidget;
});