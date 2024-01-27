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
            $('#search-button').click(function () {
                self._handleSearch();
            });
            $('#radius-slider').on('input change', function () {
                $('#radius-value').text($(this).val() + ' km');
            });
        },

        _handleSearch: function () {
            var self = this;
            var street = $('#street-input').val();
            var cep = $('#cep-input').val();
            var number = $('#number-input').val();
            var address = street + ', ' + number + ', ' + cep;

            var geocoder = new google.maps.Geocoder();
            geocoder.geocode({'address': address}, function (results, status) {
                if (status === 'OK') {
                    self.map.setCenter(results[0].geometry.location);
                    self.map.setZoom(15);

                    var radius = parseInt($('#radius-slider').val()) * 1000;
                    var circle = new google.maps.Circle({
                        map: self.map,
                        radius: radius,
                        center: results[0].geometry.location,
                        fillColor: '#AA0000',
                        fillOpacity: 0.35,
                        strokeColor: '#AA0000',
                        strokeOpacity: 0.8,
                        strokeWeight: 2
                    });
                } else {
                    alert('Geocode was not successful for the following reason: ' + status);
                }
            });
        },

        _loadGoogleMapsAPI: function (apiKey) {
            return new Promise(function (resolve, reject) {
                if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                    resolve();
                } else {
                    ajax.loadJS('https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&libraries=places,visualization')
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

            var bounds = new google.maps.LatLngBounds();

            if (Array.isArray(collectionPoints) && collectionPoints.length > 0) {
                collectionPoints.forEach(function (point) {
                    if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
                        var position = new google.maps.LatLng(point.latitude, point.longitude);
                        var marker = new google.maps.Marker({
                            position: position,
                            map: this.map,
                            title: point.name,
                            icon: icon
                        });
                        bounds.extend(position);
                    }
                }, this);

                this.map.fitBounds(bounds);
            } else {
                console.log("No collection points data found");
            }
        },
    });

    publicWidget.registry.PortalMapWidget = MapWidget;

    return MapWidget;
});
