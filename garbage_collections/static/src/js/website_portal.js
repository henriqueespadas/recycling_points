odoo.define('garbage_collection.MapWidget', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');
    var session = require('web.session');
    var ajax = require('web.ajax');

    var MapWidget = publicWidget.Widget.extend({
        selector: '.seletor_find_recycling_points_template',
        xmlDependencies: ['/garbage_collection/static/src/xml/find_recycling_points_template.xml'],

        start: function () {
            var self = this;
            this._super.apply(this, arguments);

            session.rpc('/web/dataset/call_kw', {
                model: 'ir.config_parameter',
                method: 'get_param',
                args: ['google_maps_api_key_garbage_collections'],
                kwargs: {},
            }).then(function (apiKey) {
                if (apiKey) {
                    self._loadGoogleMapsAPI(apiKey).then(function () {
                        self._fetchCollectionPoints().then(function (collectionPoints) {
                            self._initMap(collectionPoints);
                        });
                    });
                }
            });
        },

        _loadGoogleMapsAPI: function (apiKey) {
            return new Promise(function (resolve, reject) {
                if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                    resolve();
                } else {
                    ajax.loadJS('https://maps.googleapis.com/maps/api/js?key=' + apiKey)
                        .then(resolve)
                        .guardedCatch(reject);
                }
            });
        },

        _fetchCollectionPoints: function () {
            return session.rpc('/web/dataset/call_kw', {
                model: 'collection.point',
                method: 'search_read',
                args: [],
                kwargs: {
                    fields: ['street', 'house_number', 'zip', 'latitude', 'longitude'],
                    domain: [],
                    context: session.user_context,
                }
            });
        },

        _initMap: function (collectionPoints) {
            var myLatLng = {lat: -23.43, lng: -46.59};

            this.map = new google.maps.Map(document.getElementById('map-container'), {
                center: myLatLng,
                zoom: 12
            });

            var icon = {
                url: '/garbage_collections/static/src/img/marcador.png',
                scaledSize: new google.maps.Size(60, 60),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(15, 15)
            };

            if (Array.isArray(collectionPoints) && collectionPoints.length > 0) {
                collectionPoints.forEach(function (point) {
                    if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
                        new google.maps.Marker({
                            position: {lat: point.latitude, lng: point.longitude},
                            map: this.map,
                            title: point.name,
                            icon: icon // Definindo o ícone personalizado
                        });
                    }
                }, this);
            } else {
                console.log("No collection points data found");
            }
        },
    });

    publicWidget.registry.PortalMapWidget = MapWidget;

    return MapWidget;
});
