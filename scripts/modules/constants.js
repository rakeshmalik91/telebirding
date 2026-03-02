export default class Constants {
	static MODE_BIRD = "bird";
	static MODE_INSECT = "insect";
	static DEFAULT_MODE = Constants.MODE_BIRD;

	static MODE = {
		[Constants.MODE_BIRD]: {
			"logo": "icons/telebirding-logo.png",
			"title": "Telebirding - Rakesh's Bird Catalogue"
		},
		[Constants.MODE_INSECT]: {
			"logo": "icons/teleinsecta-logo.png",
			"title": "Teleinsecta - Rakesh's Insect Catalogue"
		}
	};

	static HOME = "home";
	static ARCHIVE = "feed";
	static EXPLORE_MENU = "explore_menu";
	static EXPLORE_PAGE = "explore_page";
	static MAP_MENU = "map_menu";
	static MAP = "map";
	static STORIES = "stories";
	static ABOUT = "about";

	static PAGE = {
		[Constants.HOME]: { name: "Home" },
		[Constants.ARCHIVE]: { name: "Feed" },
		[Constants.EXPLORE_MENU]: { name: "Explore Birds" },
		[Constants.EXPLORE_PAGE]: { name: "Explore Birds" },
		[Constants.MAP_MENU]: { name: "Bird Map" },
		[Constants.MAP]: { name: "Bird Map" },
		[Constants.STORIES]: { name: "Stories" },
		[Constants.ABOUT]: { name: "About" }
	};

	static DATA_DATE_FORMAT = "DD-MM-yyyy";
	static DISPLAY_DATE_FORMAT = 'D MMM, YYYY';
	static FILTER_MONTH_FORMAT = 'MMM, YYYY';
	static FILTER_YEAR_FORMAT = 'YYYY';
	static BACKUP_DATE_FORMAT = "yyyy-MM-DD";

	static TAG_SUBSPECIES = "subspecies";
	static TAG_VARIATION = "variation";
	static TAG_PLUMAGE = "plumage";
	static TAG_AGE = "age";

	static TAG_TYPES = [Constants.TAG_SUBSPECIES, Constants.TAG_VARIATION, Constants.TAG_PLUMAGE, Constants.TAG_AGE];

	static OPT_RATING = {
		"0": "-",
		"1": "★",
		"2": "★★",
		"3": "★★★",
		"4": "★★★★",
		"5": "★★★★★"
	};

	static OPT_GENDER = {
		'': '-',
		'M': "Male",
		'F': 'Female'
	};

	static OPT_AGE = {
		[Constants.MODE_BIRD]: {
			'': 'Adult',
			'Juvenile': 'Juvenile',
			'Immature': 'Immature',
			'Juvenile/Immature': 'Juvenile/Immature'
		},
		[Constants.MODE_INSECT]: {
			'': 'Adult',
			'Larva': 'Larva',
			'Pupa': 'Pupa'
		}
	};

	static OPT_PLUMAGE = {
		[Constants.MODE_BIRD]: {
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
		},
		[Constants.MODE_INSECT]: {
			'': 'Basic'
		}
	};

	static OPT_TIME_OF_DAY = {
		'': '-',
		"Dawn": "Dawn",
		"Day": "Day",
		"Dusk": "Dusk",
		"Night": "Night"
	};

	static OPT_WEATHER = {
		'': '-',
		"Sunny": "Sunny",
		"Rainy": "Rainy",
		"Hazy": "Hazy",
		"Foggy": "Foggy",
		"Cloudy": "Cloudy",
		"Snowy": "Snowy",
		"Stormy": "Stormy"
	};

	static RATING_DISPLAY_NAME = {
		[Constants.MODE_BIRD]: {
			"0": "-",
			"1": "Got the Bird",
			"2": "Record Shot",
			"3": "Decent Capture",
			"4": "Beauty Shot",
			"5": "Wow Factor"
		},
		[Constants.MODE_INSECT]: {
			"0": "-",
			"1": "Got the Insect",
			"2": "Record Shot",
			"3": "Decent Capture",
			"4": "Beauty Shot",
			"5": "Wow Factor"
		}
	};

	static RATING_CSS_CLASS_MAPPING = {
		0: 'image-rating-icon-bino',
		1: 'image-rating-icon-bino',
		2: 'image-rating-icon-bino',
		3: 'image-rating-icon-cam-blue',
		4: 'image-rating-icon-cam-yellow',
		5: 'image-rating-icon-cam-yellow'
	};

	static EBIRD_SPECIES_BASE_URL = "https://ebird.org/species/";

	static DEFAULT_AUTHOR = "Rakesh Malik";
	static AUTHOR_URL = {
		"Rakesh Malik": "https://www.instagram.com/rakeshmalik_art",
		"Ranjan Malik": "https://www.instagram.com/ranjan_033",
		"Chinmaya Mohini": "https://www.instagram.com/ratdon",
		"Latif Alvani": "https://www.instagram.com/nalsarovar_latif_alvani",
		"Shakti Vel": "https://www.instagram.com/andaman_boy"
	};

	static LIKE_ENABLED = true;

	static MEDIA_TYPE_VIDEO = 'video';
	static DEFAULT_PLUMAGE = "";

	static ARCHIVE_DATA_PER_PAGE = 12;
	static MIN_COUNT_FOR_LOCATION_LISTING = 5;
	static SIGHTING_SLIDESHOW_INTERVAL = 5000;
	static HOME_PAGE_SLIDESHOW_INTERVAL = 10000;
	static HOME_PAGE_SLIDESHOW_FADE_INTERVAL = 1000;

	static IMAGE_COMPRESSION_QUALITY = 0.7;

	static DEFAULT_TITLE = "Telebirding";
	static DEFAULT_DESCRIPTION = "Rakesh's Bird Catalogue";

	static TAG_NORMALIZE_REPLACE_MAPPING = {
		"-": " ",
		"'": "",
		"+": " ",
		"gray": "grey"
	};

	static LOCATION_SHORTEN_LIST = [
		[/\bNational\s+Park\b/gi, "N.P."],
		[/\bBiological\s+Park\b/gi, "B.P."],
		[/\bZoological\s+Park\b/gi, "Zoo"],
		[/\bBotanical\s+Garden\b/gi, "B.G."],
		[/\bWildlife\s+Sanctuary\b/gi, "W.S."],
		[/\bBird\s+Sanctuary\b/gi, "B.S."],
		[/\bTiger\s+Reserve\b/gi, "T.R."],
		[/\bConservation\s+Reserve\b/gi, "C.R."],
		[/\bBio(|sphere)\s+Reserve\b/gi, "B.R."],
		[/\bNorth(|ern)\b/gi, "N."],
		[/\bSouth(|ern)\b/gi, "S."],
		[/\bEast(|ern)\b/gi, "E."],
		[/\bWest(|ern)\b/gi, "W."],
		[/\bIslands\b/gi, "Isl."],
		[/\band\b/gi, "&"]
	];

	static LOCATION_SHORTEN_BLOCK_LIST = ["Isl.", "Monastery", "Zoo"];

	static PLUMAGE_SHORTEN_LIST = [
		[/\bJuvenile\b/gi, "Juv."],
		[/\bImmature\b/gi, "Imm."],
		[/\bBreeding(-Male|)\b/gi, "Br."],
		[/\bEclipse\b/gi, "Ecl."],
		[/\bMale\b/gi, "M"],
		[/\bFemale\b/gi, "F"]
	];
}