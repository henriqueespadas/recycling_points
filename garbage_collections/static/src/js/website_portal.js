odoo.define('garbage_collection.MapWidget', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');
    var session = require('web.session');
    var ajax = require('web.ajax');

    var MapWidget = publicWidget.Widget.extend({
        selector: '.seletor_find_recycling_points_template',
        xmlDependencies: ['/garbage_collection/static/src/xml/find_recycling_points_template.xml'],

        fetchWasteTypeNames: function (ids) {
            return session.rpc('/web/dataset/call_kw', {
                model: 'waste.type',
                method: 'search_read',
                args: [],
                kwargs: {
                    domain: [['id', 'in', ids]],
                    fields: ['name'],
                    context: session.user_context,
                }
            });
        },

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
            session.rpc('/web/dataset/call_kw', {
                model: 'waste.type',
                method: 'search_read',
                args: [],
                kwargs: {
                    fields: ['name', 'id'],
                    domain: [],
                    context: session.user_context,
                }
            }).then(function (wasteTypes) {
                wasteTypes.forEach(function (wt) {
                    $('#waste-type-select').append($('<option>', {
                        value: wt.id,
                        text: wt.name
                    }));
                });
            });
            $('#search-button').click(function () {
                self._handleSearch();
            });
            $('#radius-slider').on('input change', function () {
                $('#radius-value').text($(this).val() + ' km');
            });
        },

        currentCircle: null,
        _handleSearch: function () {
            var self = this;
            var street = $('#street-input').val();
            var cep = $('#cep-input').val();
            var number = $('#number-input').val();
            var address = street + ', ' + number + ', ' + cep;
            var wasteTypeId = $('#waste-type-select').val();

            var geocoder = new google.maps.Geocoder();
            geocoder.geocode({'address': address}, function (results, status) {
                if (status === 'OK') {
                    var location = results[0].geometry.location;
                    self.map.setCenter(location);
                    self.map.setZoom(15);

                    if (self.searchMarker) {
                        self.searchMarker.setMap(null);
                    }
                    self.searchMarker = new google.maps.Marker({
                        position: location,
                        map: self.map,
                        title: 'Localização Encontrada'
                    });

                    if (self.currentCircle) {
                        self.currentCircle.setMap(null);
                    }
                    var radius = parseInt($('#radius-slider').val()) * 1000;
                    self.currentCircle = new google.maps.Circle({
                        map: self.map,
                        radius: radius,
                        center: location,
                        fillColor: '#AA0000',
                        fillOpacity: 0.35,
                        strokeColor: '#AA0000',
                        strokeOpacity: 0.8,
                        strokeWeight: 2
                    });

                    self._fetchCollectionPoints(wasteTypeId).then(function (filteredPoints) {
                        self._initMap(filteredPoints, location);
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
                    ajax.loadJS('https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&libraries=places,visualization,geometry')
                        .then(resolve)
                        .guardedCatch(reject);
                }
            });
        },

        _fetchCollectionPoints: function (wasteTypeId) {
            var domain = [];
            if (wasteTypeId && wasteTypeId !== "") {
                domain.push(['waste_type', 'in', [parseInt(wasteTypeId)]]);
            }
            return session.rpc('/web/dataset/call_kw', {
                model: 'collection.point',
                method: 'search_read',
                args: [],
                kwargs: {
                    fields: ['street', 'house_number', 'zip', 'latitude', 'longitude', 'waste_type', 'name', 'opening_hours', 'district', 'telephone'],
                    domain: domain,
                    context: session.user_context,
                }
            });
        },

        _initMap: function (collectionPoints, centerLocation) {
            var self = this;
            this.map = new google.maps.Map(document.getElementById('map-container'), {
                center: {lat: -23.43, lng: -46.59},
                zoom: 12
            });

            var icon = {
                url: '/garbage_collections/static/src/img/marcador.png',
                scaledSize: new google.maps.Size(60, 60),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(15, 15)
            };

            var bounds = new google.maps.LatLngBounds();
            var pointsAdded = 0;

            collectionPoints.forEach(function (point) {
                var position = new google.maps.LatLng(point.latitude, point.longitude);
                var marker = new google.maps.Marker({
                    position: position,
                    map: self.map,
                    title: point.name,
                    icon: icon
                });

                marker.addListener('click', function () {
                    var wasteTypeIds = point.waste_type;

                    console.log("Waste type IDs:", wasteTypeIds);

                    if (wasteTypeIds.length > 0) {
                        self.fetchWasteTypeNames(wasteTypeIds).then(function (wasteTypeNames) {
                            var wasteTypeText = wasteTypeNames.map(function (type) {
                                return type.name;
                            }).join(', ');

                            var infoWindowContent = '<div><h2><strong><u>' + point.name + '</u></strong></h2>' +
                                point.street + ', ' + point.house_number + ', ' + point.district + ', ' + point.zip + '<br><br>' +
                                'Opening Hours: ' + '<br><strong>' + point.opening_hours + '</strong></div>' +
                                '<br><br>' + 'Tel: <strong>' + point.telephone + '</strong><br><br>' +
                                'What do we receive? <br><strong>' + wasteTypeText + '</strong></div>';

                            var infoWindow = new google.maps.InfoWindow({
                                content: infoWindowContent
                            });
                            infoWindow.open(self.map, marker);
                        }).catch(function (error) {
                            console.error("Error fetching waste type names:", error);
                        });
                    } else {
                        console.log("No waste type ids found for point:", point);
                    }
                });

                bounds.extend(position);
            });

            if (self.currentCircle) {
                self.currentCircle.setMap(self.map);
                bounds.union(self.currentCircle.getBounds());
            }

            if (!bounds.isEmpty()) {
                this.map.fitBounds(bounds);
            } else if (centerLocation) {
                this.map.setCenter(centerLocation);
                this.map.setZoom(15);
            }
        },

        _isPointInCircle: function (point, center, radius) {
            var distance = google.maps.geometry.spherical.computeDistanceBetween(point, center);
            return distance <= radius;
        },

    });

    publicWidget.registry.PortalMapWidget = MapWidget;

    return MapWidget;
});