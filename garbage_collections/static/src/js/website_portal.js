odoo.define('garbage_collections.MapWidget', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');
    var session = require('web.session');
    var ajax = require('web.ajax');
    var _t = require('web.core')._t;

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

            $('#listPointsButton').click(function () {
                self._relistCollectionPoints();
            });

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
                        title: _t('Location Found')
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

                    self.lastSearchParams = {location: location, wasteTypeId: wasteTypeId};

                    self._fetchCollectionPoints(wasteTypeId).then(function (filteredPoints) {
                        self.lastSearchResults = filteredPoints;
                        self._initMap(filteredPoints, location);
                    });
                } else {
                    alert(_t('Geocode was not successful for the following reason: ') + status);
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
                    fields: ['street', 'house_number', 'zip', 'latitude', 'longitude', 'waste_type', 'name', 'opening_hours', 'district', 'telephone', 'description'],
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

            function createInfoWindowContent(point, wasteTypeText, isAdditionalContent = false) {
    // Certifique-se de que todos os textos estão envolvidos por _t para tradução
    if (isAdditionalContent) {
        return `
            <div class="additional-info">
                <h3 class="additional-title"><u>${_t("Collection Points")}</u></h3>
                ${_t("Our database is the result of a collaboration between private initiatives, the public sector, and third sector organizations. Updates may take some time to process. We are committed to continually working to keep the platform up to date. Click the button below and learn about the initiative and our partners.")}
                <br><br>
                <button class="gc-back-btn">${_t("← Back")}</button>
            </div>`;
    } else {
        var googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(point.latitude + ',' + point.longitude)}`;
        return `
            <div class="gc-info-window-content">
                <h4><strong><u>${_t(point.name)}</u></strong></h4>
                <div class="address">${_t(point.street)}, ${point.house_number}, ${_t(point.district)}, ${point.zip}</div>
                <div class="opening-hours"><strong class="highlight">${_t("Opening Hours:")}</strong> <br>${_t(point.opening_hours)}</div>
                <div class="telephone"><strong class="highlight">${_t("Tel:")}</strong> ${point.telephone}</div>
                <div class="waste-type"><strong class="highlight">${_t("What do we receive:")}</strong> <br>${_t(wasteTypeText)}</div>
                <div class="description">${_t(point.description)}</div>
                <a href="${googleMapsUrl}" target="_blank" class="gc-go-now-btn">${_t("🚘 Go now")}</a>
                <a><i class="fa fa-info-circle gc-info-btn" aria-hidden="true"></i></a>
            </div>`;
    }
}

            collectionPoints.forEach(function (point) {
                var pointLocation = new google.maps.LatLng(point.latitude, point.longitude);

                if (!self.currentCircle || google.maps.geometry.spherical.computeDistanceBetween(pointLocation, self.currentCircle.getCenter()) <= self.currentCircle.getRadius()) {
                    var marker = new google.maps.Marker({
                        position: pointLocation,
                        map: self.map,
                        title: point.name,
                        icon: icon
                    });

                    marker.addListener('click', function () {
                        var wasteTypeIds = point.waste_type.map(function (type) {
                            return type[0];
                        });
                        self.fetchWasteTypeNames(wasteTypeIds).then(function (wasteTypeNames) {
                            var wasteTypeText = wasteTypeNames.map(function (type) {
                                return type.name;
                            }).join(', ');
                            var contentString = createInfoWindowContent(point, wasteTypeText);
                            var infoWindow = new google.maps.InfoWindow({content: contentString});

                            infoWindow.open(self.map, marker);

                            google.maps.event.addListener(infoWindow, 'domready', function () {
                                var infoButton = document.querySelector('.gc-info-btn');
                                var backButton = document.querySelector('.gc-back-btn');

                                if (infoButton) {
                                    infoButton.addEventListener('click', function () {
                                        infoWindow.setContent(createInfoWindowContent(point, wasteTypeText, true));
                                    });
                                }
                                if (backButton) {
                                    backButton.addEventListener('click', function () {
                                        infoWindow.setContent(createInfoWindowContent(point, wasteTypeText, false));
                                    });
                                }
                            });
                        }).catch(function (error) {
                            console.error(_t("Error fetching waste type names:", error));
                        });
                    });
                }
                bounds.extend(pointLocation);
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
        _relistCollectionPoints: function () {
            var self = this;
            if (self.lastSearchParams && self.currentCircle) {
                self._fetchCollectionPoints(self.lastSearchParams.wasteTypeId).then(function (filteredPoints) {
                    var filteredPointsWithinCircle = filteredPoints.filter(function (point) {
                        var pointLocation = new google.maps.LatLng(point.latitude, point.longitude);
                        return google.maps.geometry.spherical.computeDistanceBetween(pointLocation, self.currentCircle.getCenter()) <= self.currentCircle.getRadius();
                    });

                    var modalBody = $('#collectionPointsModal').find('.modal-body');
                    modalBody.empty();

                    filteredPointsWithinCircle.forEach(function (point) {
                        modalBody.append(`<p>Name: ${point.name}<br>Address: ${point.street}, ${point.house_number}<br>Description: ${point.description}</p><hr>`);
                    });

                    $('#collectionPointsModal').modal('show');
                });
            } else {
                alert(_t('No previous searches found or circle not defined..'));
            }
        },


    });


    publicWidget.registry.PortalMapWidget = MapWidget;

    return MapWidget;
});