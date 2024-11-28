odoo.define('recycling_points.MapWidget', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');
    var session = require('web.session');
    var ajax = require('web.ajax');
    var _t = require('web.core')._t;

    var MapWidget = publicWidget.Widget.extend({
        selector: '.seletor_find_recycling_points_template',
        xmlDependencies: ['/recyling_points/static/src/xml/find_recycling_points_template.xml'],

        initializeSelectors: function () {
            this.$listPointsButton = $('#listPointsButton');
            this.$searchButton = $('#search-button');
            this.$radiusSlider = $('#radius-slider');
            this.$radiusValue = $('#radius-value');
            this.$wasteTypeSelect = $('#waste-type-select');
            this.$modalBody = $('#collectionPointsModal .modal-body');
        },

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

        _fetchGoogleMapsApiKey: function () {
            return session.rpc('/web/dataset/call_kw', {
                model: 'ir.config_parameter',
                method: 'get_param',
                args: ['google_maps_api_key'],
                kwargs: {},
            });
        },

        _fetchWasteTypes: function () {
            return session.rpc('/web/dataset/call_kw', {
                model: 'waste.type',
                method: 'search_read',
                args: [],
                kwargs: {
                    fields: ['name', 'id'],
                    domain: [],
                    context: session.user_context,
                }
            });
        },

        start: function () {
            var self = this;
            this._super.apply(this, arguments);
            this.initializeSelectors();
            this._bindEventHandlers();

            this._fetchGoogleMapsApiKey().then(function (apiKey) {
                if (apiKey) {
                    self._loadGoogleMapsAPI(apiKey).then(function () {
                        self._fetchCollectionPoints().then(function (collectionPoints) {
                            self._initMap(collectionPoints);
                        });
                    });
                }
            });

            this._fetchWasteTypes().then(function (wasteTypes) {
                wasteTypes.forEach(function (wt) {
                    self.$wasteTypeSelect.append($('<option>', {
                        value: wt.id,
                        text: wt.name
                    }));
                });
            });
        },

        _bindEventHandlers: function () {
            var self = this;
            this.$listPointsButton.click(function () {
                self._relistCollectionPoints();
            });

            this.$searchButton.click(function () {
                self._handleSearch();
            });

            this.$radiusSlider.on('input change', function () {
                self.$radiusValue.text($(this).val() + ' km');
            });

            $('#find-me-button').click(function () {
                self._handleFindMe();
            });
        },

        _handleFindMe: function () {
            var self = this;
            this._getCurrentPosition().then(function (location) {
                self._updateMapCenterAndZoom(location);
                self._replaceSearchMarker(location);
                self._reverseGeocode(location);
            }).catch(function (error) {
                alert(_t('Geolocation is not supported by this browser.'));
            });
        },

        _getCurrentPosition: function () {
            return new Promise(function (resolve, reject) {
                if (!navigator.geolocation) {
                    reject(_t('Geolocation is not supported by this browser.'));
                } else {
                    navigator.geolocation.getCurrentPosition(function (position) {
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    }, reject);
                }
            });
        },

        _reverseGeocode: function (location) {
            var self = this;
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({'location': location}, function (results, status) {
                if (status === 'OK' && results[0]) {
                    const addressComponents = results[0].address_components;
                    self._updateAddressFields(addressComponents);
                } else {
                    window.alert('No results found');
                }
            }).catch(function (error) {
                window.alert(`Geocoding failed due to: ${error}`);
            });
        },

        _updateAddressFields: function (addressComponents) {
            const address = addressComponents.find(component => component.types.includes('route'));
            const postalCode = addressComponents.find(component => component.types.includes('postal_code'));
            const streetNumber = addressComponents.find(component => component.types.includes('street_number'));
            $('#street-input').val(address ? address.long_name : '');
            $('#cep-input').val(postalCode ? postalCode.long_name : '');
            $('#number-input').val(streetNumber ? streetNumber.long_name : '');
        },


        _geocodeAddress: function (address) {
            return new Promise((resolve, reject) => {
                var geocoder = new google.maps.Geocoder();
                geocoder.geocode({'address': address}, function (results, status) {
                    if (status === 'OK') {
                        resolve(results[0].geometry.location);
                    } else {
                        reject(status);
                    }
                });
            });
        },

        async _handleSearch() {
            try {
                const street = $('#street-input').val().trim();
                const number = $('#number-input').val().trim();
                const cep = $('#cep-input').val().trim();

                if (!street || !number || !cep) {
                    alert('Please fill in all address fields.');
                    return;
                }

                const address = `${street}, ${number}, ${cep}`;
                const wasteTypeId = $('#waste-type-select').val();
                const radius = $('#radius-slider').val();

                const location = await this._geocodeAddress(address);
                if (!location) throw new Error('Location not found');

                this._updateMapCenterAndZoom(location);
                this._replaceSearchMarker(location);
                this._replaceCurrentCircle(location, radius);

                this.lastSearchParams = {location, wasteTypeId};
                const filteredPoints = await this._fetchCollectionPoints(wasteTypeId);
                this.lastSearchResults = filteredPoints;
                this._initMap(filteredPoints, location);
            } catch (error) {
                this._handleSearchError(error);
            }
        },

        _updateMapCenterAndZoom(location) {
            const radiusValue = parseFloat(document.getElementById('radius-value').value);
            const zoomLevel = this._calculateZoomLevel(radiusValue);
            this.map.setCenter(location);
            this.map.setZoom(zoomLevel);
        },

        _calculateZoomLevel(radius) {
            if (radius <= 100) {
                return 16;
            } else if (radius <= 500) {
                return 14;
            } else if (radius <= 1000) {
                return 13;
            } else if (radius <= 5000) {
                return 12;
            } else {
                return 15;
            }
        },

        _replaceSearchMarker(location) {
            if (this.searchMarker) {
                this.searchMarker.setMap(null);
            }
            this.searchMarker = new google.maps.Marker({
                position: location,
                map: this.map,
                title: _t('Location Found')
            });
        },

        _replaceCurrentCircle(location, radiusValue) {
            if (this.currentCircle) {
                this.currentCircle.setMap(null);
            }
            const radius = parseInt(radiusValue) * 1000;
            this.currentCircle = new google.maps.Circle({
                map: this.map,
                radius,
                center: location,
                fillColor: '#ADD8E6',
                fillOpacity: 0.35,
                strokeColor: '#AA0000',
                strokeOpacity: 0.8,
                strokeWeight: 2
            });
        },

        _handleSearchError(error) {
            console.error("Geocode or fetching collection points failed:", error);
            alert(_t('Geocode was not successful. Please check the address and try again.') + error);
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
                    fields: ['street', 'number', 'zip', 'latitude', 'longitude', 'waste_type', 'name', 'opening_hours', 'district', 'telephone', 'description'],
                    domain: domain,
                    context: session.user_context,
                }
            });
        },

        _initMap: function (collectionPoints, centerLocation) {
            this.initializeMap(centerLocation);
            this.addCollectionPointsToMap(collectionPoints);
            this.adjustMapViewToBounds(centerLocation);
            this.addCentralMarker(centerLocation);
        },

        addCentralMarker: function (centerLocation) {
            if (this.centralMarker) {
                this.centralMarker.setMap(null);
            }
            this.centralMarker = new google.maps.Marker({
                position: centerLocation,
                map: this.map,
                title: 'Central Location'
            });
        },

        initializeMap: function (centerLocation) {
            this.map = new google.maps.Map(document.getElementById('map-container'), {
                center: centerLocation || {lat: -23.43, lng: -46.59},
                zoom: 12
            });
        },

        addCollectionPointsToMap(collectionPoints) {
            const {bounds, pointsAdded} = this.calculateBoundsForCollectionPoints(collectionPoints);
            this.updateMapBounds(bounds, pointsAdded);
            this.handleMapZoomForSinglePoint(collectionPoints);
        },

        calculateBoundsForCollectionPoints(collectionPoints) {
            const bounds = new google.maps.LatLngBounds();
            let pointsAdded = 0;

            collectionPoints.forEach(point => {
                const pointLocation = new google.maps.LatLng(point.latitude, point.longitude);
                if (!this.currentCircle || this.isPointWithinCurrentCircle(pointLocation)) {
                    const marker = this.createMarkerForPoint(point, pointLocation);
                    this.attachMarkerClickEvent(marker, point);
                    bounds.extend(pointLocation);
                    pointsAdded++;
                }
            });

            if (this.currentCircle) {
                this.currentCircle.setMap(this.map);
                bounds.union(this.currentCircle.getBounds());
            }
            return {bounds, pointsAdded};
        },

        updateMapBounds(bounds, pointsAdded) {
            this.map.fitBounds(bounds);
            if (pointsAdded === 0) {
                this.displayNoPointsAlert();
            }
        },

        handleMapZoomForSinglePoint(collectionPoints) {
            if (collectionPoints.length === 1) {
                setTimeout(() => this.map.setZoom(13), 300);
            }
        },

        displayNoPointsAlert() {
            alert(_t('No collection points found within the selected area.'));
        },

        isPointWithinCurrentCircle: function (pointLocation) {
            return google.maps.geometry.spherical.computeDistanceBetween(pointLocation, this.currentCircle.getCenter()) <= this.currentCircle.getRadius();
        },

        createMarkerForPoint: function (point, pointLocation) {
            const icon = {
                url: '/recycling_points/static/src/img/pointer.png',
                scaledSize: new google.maps.Size(60, 60),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(30, 30)
            };

            const marker = new google.maps.Marker({
                position: pointLocation,
                map: this.map,
                title: point.name,
                icon: icon
            });
            marker.set('point', point);

            return marker;
        },

        attachMarkerClickEvent: function (marker, point) {
            marker.addListener('click', () => {
                this.fetchWasteTypeNames(point.waste_type).then(wasteTypeNames => {
                    const wasteTypeText = wasteTypeNames.map(type => type.name).join(', ');
                    marker.set('wasteTypeText', wasteTypeText);
                    const infoWindowContent = this.createInfoWindowContent(point, wasteTypeText);
                    this.showInfoWindow(marker, infoWindowContent);
                }).catch(error => {100
                    console.error("Error fetching waste type names:", error);
                });
            });
        },

        createInfoWindowContent(point, wasteTypeText, isAdditionalContent = false) {
            if (isAdditionalContent) {
                return `
            <div class="additional-info">
                <h3 class="additional-title"><u>${_t("Collection Points")}</u></h3>
                ${_t("Our database is the result of a collaboration between multiple sources. Updates may take some time to process. We are committed to continually working to keep the platform up to date. Click the button below and learn about the initiative and our partners.")}
                <br><br>
                <button class="btn btn-warning ">${_t("← Back")}</button>
            </div>`;
            } else {
                var googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(point.latitude + ',' + point.longitude)}`;
                return `
            <div class="gc-info-window-content">
                <h2><strong><u>${_t(point.name)}</u></strong></h2>
                <div class="address">${_t(point.street)}, ${point.number}, ${_t(point.district)}, ${point.zip}</div>
                <div class="opening-hours"><strong class="highlight">${_t("Opening Hours: ")}</strong>${_t(point.opening_hours)}</div>
                <div class="telephone"><strong class="highlight">${_t("Tel:")}</strong> ${point.telephone}</div>
                <div class="waste-type"><strong class="highlight">${_t("What do we receive: ")}</strong>${_t(wasteTypeText)}</div>
                <div class="description">${_t(point.description)}</div>
                <a href="${googleMapsUrl}" target="_blank" class="gc-go-now-btn">${_t("🚘 Go now")}</a>
                <a><i class="fa fa-info-circle gc-info-btn" aria-hidden="true"></i></a>
            </div>`;
            }
        },

        showInfoWindow(marker, contentString) {
            if (this.currentInfoWindow) {
                this.currentInfoWindow.close();
            }
            const infoWindow = new google.maps.InfoWindow({content: contentString});
            infoWindow.open(this.map, marker);
            this.currentInfoWindow = infoWindow;

            google.maps.event.addListener(infoWindow, 'domready', () => {
                this.setupInfoWindowButtons(marker, infoWindow);
            });
        },

        setupInfoWindowButtons(marker, infoWindow) {
            const backButton = document.querySelector('.btn-warning');
            if (backButton) {
                backButton.onclick = () => this.handleBackButtonClick(marker, infoWindow);
            }

            const infoButton = document.querySelector('.gc-info-btn');
            if (infoButton) {
                infoButton.onclick = () => this.handleInfoButtonClick(marker, infoWindow);
            }
        },

        handleBackButtonClick(marker, infoWindow) {
            const point = marker.get('point');
            const wasteTypeText = marker.get('wasteTypeText');

            if (point && wasteTypeText) {
                infoWindow.setContent(this.createInfoWindowContent(point, wasteTypeText, false));
            } else {
                console.error('Error: point or text of the specification type not defined.');
            }
        },

        handleInfoButtonClick(marker, infoWindow) {
            const point = marker.get('point');
            const wasteTypeText = marker.get('wasteTypeText');
            infoWindow.setContent(this.createInfoWindowContent(point, wasteTypeText, true));
        },

        adjustMapViewToBounds: function (centerLocation) {
            if (this.map && this.map.getBounds && typeof this.map.getBounds === 'function') {
                const bounds = this.map.getBounds();
                if (bounds && !bounds.isEmpty()) {
                    this.map.fitBounds(bounds);
                } else if (centerLocation) {
                    this.map.setCenter(centerLocation);
                    this.map.setZoom(15);
                }
            } else if (centerLocation) {
                this.map.setCenter(centerLocation);
                this.map.setZoom(15);
            }
        },

        _relistCollectionPoints: function () {
            var self = this;
            var fetchPoints = function (wasteTypeId) {
                return self._fetchCollectionPoints(wasteTypeId).then(function (filteredPoints) {
                    var pointsToDisplay = filteredPoints;
                    if (self.currentCircle) {
                        pointsToDisplay = filteredPoints.filter(function (point) {
                            var pointLocation = new google.maps.LatLng(point.latitude, point.longitude);
                            return google.maps.geometry.spherical.computeDistanceBetween(pointLocation, self.currentCircle.getCenter()) <= self.currentCircle.getRadius();
                        });
                    }

                    self.$modalBody.empty();

                    pointsToDisplay.forEach(function (point) {
                        self.$modalBody.append(`<p>Name: ${point.name}<br>Address: ${point.street}, ${point.number}<br>Description: ${point.description}</p><hr>`);
                    });

                    $('#collectionPointsModal').modal('show');
                });
            };
            if (self.lastSearchParams && self.currentCircle) {
                fetchPoints(self.lastSearchParams.wasteTypeId);
            } else {
                fetchPoints();
            }
        },
    });

    publicWidget.registry.PortalMapWidget = MapWidget;

    return MapWidget;
});