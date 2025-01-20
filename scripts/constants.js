var MODE_BIRD = "bird";
var MODE_INSECT = "insect";
var MODE = {};
var DEFAULT_MODE = MODE_BIRD;
MODE[MODE_BIRD] = {
	"logo": "icons/telebirding-logo.png",
	"title": "Telebirding - Rakesh's Bird Catalogue"
}
MODE[MODE_INSECT] = {
	"logo": "icons/teleinsecta-logo.png",
	"title": "Teleinsecta - Rakesh's Insect Catalogue"
}

var HOME = "home";
var ARCHIVE = "feed";
var EXPLORE_MENU = "explore_menu";
var EXPLORE_PAGE = "explore_page";
var MAP_MENU = "map_menu";
var MAP = "map";
var VIDEOS = "videos";
var ABOUT = "about";

var PAGE = {};
PAGE[HOME] = {name: "Home"};
PAGE[ARCHIVE] = {name: "Feed"};
PAGE[EXPLORE_MENU] = {name: "Explore Birds"};
PAGE[EXPLORE_PAGE] = {name: "Explore Birds"};
PAGE[MAP_MENU] = {name: "Bird Map"};
PAGE[MAP] = {name: "Bird Map"};
PAGE[VIDEOS] = {name: "Birding Trips"};
PAGE[ABOUT] = {name: "About"};

var DATA_DATE_FORMAT = "DD-MM-yyyy";
var DISPLAY_DATE_FORMAT = 'D MMM, YYYY';
var FILTER_MONTH_FORMAT = 'MMM, YYYY';
var FILTER_YEAR_FORMAT = 'YYYY';
var BACKUP_DATE_FORMAT = "yyyy-MM-DD";

var OPT_RATING = {
	"0": "-",
	"1": "★",
	"2": "★★",
	"3": "★★★",
	"4": "★★★★",
	"5": "★★★★★"
}
var OPT_GENDER = {
	'': '-', 
	'M': "Male", 
	'F': 'Female'
};
var OPT_AGE = {
	'': 'Adult', 
	'Juvenile': 'Juvenile', 
	'Immature': 'Immature',
	'Juvenile/Immature': 'Juvenile/Immature'
};
var OPT_PLUMAGE = {
	'': 'Basic', 
	'Non-Breeding': 'Non-Breeding', 
	'Breeding': 'Breeding', 
	'Winter': 'Winter', 
	'Eclipse': 'Eclipse', 
	'Molting': 'Molting', 
	'Immature/Non-Breeding': 'Immature/Non-Breeding', 
	'Immature/Female': 'Immature/Female',
	'Female/Non-Breeding-Male': 'Female/Non-Breeding',
	'1st-Winter': '1st-Winter'
};
var OPT_TIME_OF_DAY = {
	'': '-',
	"Dawn": "Dawn",
	"Day": "Day",
	"Dusk": "Dusk",
	"Night": "Night"
};
var OPT_WEATHER = {
	'': '-',
	"Sunny": "Sunny",
	"Rainy": "Rainy",
	"Hazy": "Hazy",
	"Foggy": "Foggy",
	"Cloudy": "Cloudy",
	"Snowy": "Snowy"
};