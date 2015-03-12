(function() {

	var gmap_key = monarch_gmap_key,
	flickr_key = monarch_flickr_key,
	map,
	photos = [],
	sightings = [],
	heatmapdata = [],
	heatmaps = [],
	years = [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015],
	loaded = {},
	maxPhotos = 0,
	errCount = 0,
heatmapGradient = ['#ffffff','#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#bd0026','#800026'],
	csv = [];
	bbox = {
		'maxlat': 90,
		'maxlon': -20,
		'minlat': 0,
		'minlon': -180
	};


	function getTodayDateForYear(year) {
		var today = new Date(), date;

		if(!year) {
			year = today.getFullYear();
		}

		// note getMonth() returns 0-11, not 1-12, so we add 1
		date = year + '-' + (today.getMonth() + 1) + '-' + today.getDate();
	//	date = year + '-12-31';

		return date;
	}


	function callFlickrAPI(params) {
		var url = 'https://api.flickr.com/services/rest/?', stag = document.createElement('script'), isFirst = true;

		for ( var param in params ) {
			if(params.hasOwnProperty(param)) {
				if(!isFirst) {
					url += '&';
				} else {
					isFirst = false;
				}
				url += param + '=' + encodeURIComponent(params[param]);
			}
		}

		stag.src = url;
		document.body.appendChild(stag);
	}


	function maybeFinishedLoading() {
		var doneLoading = true,
		yr,
		yearsgroup = document.querySelectorAll('.years')[0],
		yrbtn;
		for(yr in loaded) {
			if(!loaded[yr]) {
				doneLoading = false;
				break;
			}
		}

		//console.log(photos);

		if(doneLoading) {
			document.body.className = 'dataloaded';

			for (var i = 0; i < years.length; i++) {
				yrbtn = document.createElement('a');
				yrbtn.appendChild(document.createTextNode(years[i]));
				yrbtn.addEventListener('click', yearButtonClicked, false);
				yrbtn.className = 'button';
				yearsgroup.appendChild(yrbtn);
			}
			toggleMoreInfo(null);
		}
	}


	function showHeatMap(year) {
		// clear any existing heatmaps
		for (var i = heatmaps.length - 1; i >= 0; i--) {
			if(heatmaps[i] && heatmaps[i].setMap) {
				heatmaps[i].setMap(null);
			}
		}


		// for kicks, display the heatmap
		//console.log('Intensity (' + year + '): ' + (heatmapdata[year].length / maxPhotos));
		if(!heatmaps[year]) {
			heatmaps[year] = new google.maps.visualization.HeatmapLayer({
				data: heatmapdata[year],
				maxIntensity: (heatmapdata[year].length / maxPhotos),
				gradient: heatmapGradient
			});
		}

		heatmaps[year].setMap(map);
	}

	function yearButtonClicked(evt) {

		showHeatMap(this.innerHTML);

		// remove active class from all buttons
		
		var buttons = document.querySelectorAll('.years .button.current');
		for(var i=0; i<buttons.length; i++) {
			buttons[i].className = buttons[i].className.replace(' current', '');
		}

		this.className += ' current';

		return false;
	}


	function showErrorLoadingPhotos(resp) {
		console.log('Error loading photos:');
		console.log(resp);

		document.querySelectorAll('.toolbar .loading')[0].innerHTML = 'Uh-oh! There was an error loading photo data. Refresh the page to try again.';
	}

	function isInBoundingBox(lat, lon) {

		// is the latitude outside of the allowed range?
		if( bbox.maxlat < lat || bbox.minlat > lat ) {
			return false;
		}

		// is the longitude out of the allowed range?
		if( bbox.maxlon < lon || bbox.minlon > lon ) {
			return false;
		}

		return true;

	}

	function loadButterfliesForYear(year) {
		// will need to make an API call, and in processing, if there's more
		// I'll need to load more butterflies.

		window['monarchFlickrData' + year] = function(resp) {

			if(resp.photos && resp.photos.total > 0) {
				if(!photos[year]) {
					photos[year] = [];
				}
				photos[year] = photos[year].concat(resp.photos.photo);

				if(resp.photos.page < resp.photos.pages && resp.photos.photo.length > 0) {
					var params = JSON.parse(JSON.stringify(flickr_params));
					params.min_taken_date = year + '-01-01';
					params.max_taken_date = getTodayDateForYear(year);
					params.page = resp.photos.page + 1;
					params.jsoncallback = 'monarchFlickrData' + year;

					callFlickrAPI(params);

				} else if(resp.photos.page == resp.photos.pages || resp.photos.photo.length === 0) {

					if(!sightings[year]) {
						sightings[year] = [];
						heatmapdata[year] = [];
						csv[year] = "date,latitude,longitude\n";
					}


					var sighting_list = '', photo, sighting, dateParts, sighting_id;

					console.log(year +' has ' + photos[year].length + ' photos.');

					for (var i = photos[year].length - 1; i >= 0; i--) {
						photo = photos[year][i];


						dateParts = photo.datetaken.split(' ')[0].split('-');
						sighting_id = photo.place_id + dateParts[0]+dateParts[1]+dateParts[2];
						if( sighting_list.indexOf(sighting_id) == -1 ) {
							if( isInBoundingBox( photo.latitude, photo.longitude ) ) {

								dateParts = photo.datetaken.split(' ')[0].split('-');
								sighting_id = photo.place_id + dateParts[0]+dateParts[1]+dateParts[2];
								if( sighting_list.indexOf(sighting_id) == -1 ) {



									sighting = {
										'location': new google.maps.LatLng(photo.latitude, photo.longitude),
										'taken' : {
											'year': dateParts[0],
											'month': dateParts[1],
											'day': dateParts[2]
										}
									};


									csv[year] += dateParts[0] + "-" + dateParts[1] + "-" + dateParts[2] + "," + photo.latitude + "," + photo.longitude + "\n";

									sighting_list += sighting_id;

									sightings[year].push(sighting);
									heatmapdata[year].push(sighting.location);

								}

							}
						}
					}

					// sort the photos & get them ready for use.
					if(heatmapdata[year].length > maxPhotos) {
						maxPhotos = heatmapdata[year].length;
					}

					loaded[year] = true;
					maybeFinishedLoading();
				}
			} else {
				showErrorLoadingPhotos(resp);
			}
		};

		var flickr_params = {
			'method': 'flickr.photos.search',
			'api_key': flickr_key,
			'text': 'monarch butterfly -tatoo -tattoo -sketch',
			'min_taken_date': year + '-01-01',
			'max_taken_date': getTodayDateForYear(year),
			'content_type': 1,
			'media': 'photos',
			'has_geo': 1,
			'extras': 'geo,date_taken',
			'per_page': 500,
			'page':1,
			'format':'json',
//			'bbox':'-180,0,-20,90',
			'jsoncallback':'monarchFlickrData' + year,
			'sort': 'date-taken-asc'
		};

		callFlickrAPI(flickr_params);




	}



	window.startMonarch = function() {
		var mapOptions = {
			zoom: 4,
			center: new google.maps.LatLng(42.0730555556, -91.546666667),
			mapTypeId: google.maps.MapTypeId.HYBRID,
			mapTypeControl: true,
			mapTypeControlOptions: {
				style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
				position: google.maps.ControlPosition.TOP_LEFT
			}
		};
		google.maps.visualRefresh = true;
		map = new google.maps.Map(document.querySelectorAll('.migration-map')[0], mapOptions);


		// mark each year as not yet loaded & start them loading
		for (var i = years.length - 1; i >= 0; i--) {
			loaded[years[i]] = false;
			loadButterfliesForYear(years[i]);
		}

		
	};

	window.logCSVForYear = function(year) {
		if( csv[year] ) {
			console.log(csv[year]);
		} else {
			console.log('no csv available for ' + year );
		}
	}


	function initMap() {

		var stag = document.createElement('script');
		stag.src = "https://maps.googleapis.com/maps/api/js?key=" + gmap_key + "&sensor=false&callback=startMonarch&libraries=visualization";
		document.body.appendChild(stag);
	}

	initMap();

	function toggleMoreInfo(evt) {

		var more = document.querySelectorAll('.how-its-done')[0];
		if(more.className.indexOf('invisible') > -1 ) {
			more.className = more.className.replace(' invisible', '');
		} else {
			more.className += ' invisible';
		}
	}

	function initHowItWorks() {
		var more, intro = document.querySelectorAll('.intro')[0];
		more = document.createElement('a');
		more.appendChild(document.createTextNode('More'));
		more.className = 'morelink';
		more.addEventListener('click', toggleMoreInfo, false);
		intro.appendChild(more);
	}

	initHowItWorks();



	// figure out which years of data we want to use
	var thisYear = new Date();
	for(var y = thisYear - 5; y <= thisYear.getFullYear(); y++) {
		years.push(y);
	}




}());