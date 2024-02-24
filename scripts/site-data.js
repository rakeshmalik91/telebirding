var carousalVisibleIndex;

function showCarousalImage(index) {
	var images = $('.home .featured .image');
	$(images[carousalVisibleIndex]).hide();
	carousalVisibleIndex = index;
	$(images[carousalVisibleIndex]).show();
	$('.home .featured .carousal-buttons button').removeClass('active-carousal-button');
	$($('.home .featured .carousal-buttons button').get(carousalVisibleIndex)).addClass('active-carousal-button');
}

function playCarousal() {
	var images = $('.home .featured .image');
	showCarousalImage((carousalVisibleIndex + 1 + images.length) % images.length);
}

function renderHomePageCarousal(featured) {
	featured.forEach(function(image, index) {
		$('.home .featured .images').append('<div class="image carousal-animation" style="opacity:0;"><img src="' + getMedia(image.src) + '" alt="' + image.alt + '" title="' + image.alt + '"/><span class="title">' + image.titleLine1 + '<br>' + image.titleLine2 + '</span></div>');
		$('.home .featured .carousal-buttons').append('<button type="button" onclick="showCarousalImage(' + index + ')"></button>');
	});
}

function renderTrips(trips) {
	var div = $('.videos');
	trips.forEach(function(trip) {
		var videoHtml = '<iframe class="youtube" src="https://www.youtube.com/embed/' + trip.youtubeVideoId + '?enablejsapi=1&version=3&playerapiid=ytplayer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="true" allowscriptaccess="always"></iframe>';
		var video = $(videoHtml).get(0);
		$('.videos').append('<div class="video"><h1>' + trip.title + '</h1>' + video.outerHTML + '</div>');
	});
}

$(document).ready(function() {
	readJSONFile(getData('data/site-data.json'), function(json) {
		renderHomePageCarousal(json.featured);

		carousalVisibleIndex = -1;
		// carousalVisibleIndex = Math.floor(Math.random() * $('.home .featured .image').length)
		$('.home .featured .image').hide();

		playCarousal();

		setInterval(function () {
			playCarousal();
		}, 30000);

		renderTrips(json.trips);
	});
});