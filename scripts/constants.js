export const MODE_BIRD = "bird";
export const MODE_INSECT = "insect";
export const MODE = {};
export const DEFAULT_MODE = MODE_BIRD;
MODE[MODE_BIRD] = {
	"logo": "icons/telebirding-logo.png",
	"title": "Telebirding - Rakesh's Bird Catalogue"
}
MODE[MODE_INSECT] = {
	"logo": "icons/teleinsecta-logo.png",
	"title": "Teleinsecta - Rakesh's Insect Catalogue"
}

export const HOME = "home";
export const ARCHIVE = "feed";
export const EXPLORE_MENU = "explore_menu";
export const EXPLORE_PAGE = "explore_page";
export const MAP_MENU = "map_menu";
export const MAP = "map";
export const VIDEOS = "videos";
export const ABOUT = "about";

export const PAGE = {};
PAGE[HOME] = { name: "Home" };
PAGE[ARCHIVE] = { name: "Feed" };
PAGE[EXPLORE_MENU] = { name: "Explore Birds" };
PAGE[EXPLORE_PAGE] = { name: "Explore Birds" };
PAGE[MAP_MENU] = { name: "Bird Map" };
PAGE[MAP] = { name: "Bird Map" };
PAGE[VIDEOS] = { name: "Birding Trips" };
PAGE[ABOUT] = { name: "About" };

export const DATA_DATE_FORMAT = "DD-MM-yyyy";
export const DISPLAY_DATE_FORMAT = 'D MMM, YYYY';
export const FILTER_MONTH_FORMAT = 'MMM, YYYY';
export const FILTER_YEAR_FORMAT = 'YYYY';
export const BACKUP_DATE_FORMAT = "yyyy-MM-DD";

export const TAG_SUBSPECIES = "subspecies";
export const TAG_VARIATION = "variation";
export const TAG_PLUMAGE = "plumage";
export const TAG_AGE = "age";

export const OPT_RATING = {
	"0": "-",
	"1": "★",
	"2": "★★",
	"3": "★★★",
	"4": "★★★★",
	"5": "★★★★★"
}
export const OPT_GENDER = {
	'': '-',
	'M': "Male",
	'F': 'Female'
};

export const OPT_AGE = {};
OPT_AGE[MODE_BIRD] = {
	'': 'Adult',
	'Juvenile': 'Juvenile',
	'Immature': 'Immature',
	'Juvenile/Immature': 'Juvenile/Immature'
};
OPT_AGE[MODE_INSECT] = {
	'': 'Adult',
	'Larva': 'Larva',
	'Pupa': 'Pupa'
};

export const OPT_PLUMAGE = {};
OPT_PLUMAGE[MODE_BIRD] = {
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
OPT_PLUMAGE[MODE_INSECT] = {
	'': 'Basic'
};

export const OPT_TIME_OF_DAY = {
	'': '-',
	"Dawn": "Dawn",
	"Day": "Day",
	"Dusk": "Dusk",
	"Night": "Night"
};
export const OPT_WEATHER = {
	'': '-',
	"Sunny": "Sunny",
	"Rainy": "Rainy",
	"Hazy": "Hazy",
	"Foggy": "Foggy",
	"Cloudy": "Cloudy",
	"Snowy": "Snowy",
	"Stormy": "Stormy"
};

export const RATING_DISPLAY_NAME = {};
RATING_DISPLAY_NAME[MODE_BIRD] = {
	"0": "-",
	"1": "Record",
	"2": "Got the Bird",
	"3": "Decent Capture",
	"4": "Beauty Shot",
	"5": "Wow Factor"
};
RATING_DISPLAY_NAME[MODE_INSECT] = {
	"0": "-",
	"1": "Record",
	"2": "Got the Insect",
	"3": "Decent Capture",
	"4": "Beauty Shot",
	"5": "Wow Factor"
};
export const RATING_CSS_CLASS_MAPPING = {
	0: 'image-rating-icon-bino',
	1: 'image-rating-icon-bino',
	2: 'image-rating-icon-bino',
	3: 'image-rating-icon-cam-blue',
	4: 'image-rating-icon-cam-yellow',
	5: 'image-rating-icon-cam-yellow'
}

export const EBIRD_SPECIES_BASE_URL = "https://ebird.org/species/";

export const DEFAULT_AUTHOR = "Rakesh Malik";
export const AUTHOR_URL = {
	"Rakesh Malik": "https://www.instagram.com/rakeshmalik_art",
	"Ranjan Malik": "https://www.instagram.com/ranjan_033",
	"Chinmaya Mohini": "https://www.instagram.com/ratdon",
	"Latif Alvani": "https://www.instagram.com/nalsarovar_latif_alvani"
};

export const LIKE_ENABLED = true;