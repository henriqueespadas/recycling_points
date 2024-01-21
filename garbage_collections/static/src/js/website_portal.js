odoo.define('garbage_collection.MapWidget', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');
    var core = require('web.core');

    var QWeb = core.qweb;

    var MapWidget = publicWidget.Widget.extend({
        selector: '.seletor_find_recycling_points_template',
        xmlDependencies: ['/garbage_collection/static/src/xml/find_recycling_points_template.xml'],

        start: function () {
            this._super.apply(this, arguments);

            var myLatLng = {lat: -34.397, lng: 150.644};

            this.map = new google.maps.Map(document.getElementById('map-container'), {
                center: myLatLng,
                zoom: 8
            });

            new google.maps.Marker({
                position: myLatLng,
                map: this.map,
                title: 'Hello World!'
            });
        },
    });

    publicWidget.registry.PortalMapWidget = MapWidget;

    return MapWidget;
});