export default class Constants {
	static ADMIN_USE_ETAG = true;
	static MODE_BIRD = "bird";
	static MODE_INSECT = "insect";
	static DEFAULT_MODE = Constants.MODE_BIRD;

	// Ordered list of modes for the toggle UI (extensible — add new modes here and in MODE)
	static MODES = [Constants.MODE_BIRD, Constants.MODE_INSECT];

	static MODE = {
		[Constants.MODE_BIRD]: {
			"logo": "icons/telebirding-logo.png",
			"title": "Telebirding - Rakesh's Bird Catalogue",
			"label": "Bird",
			"icon": "icons/bird-icon.svg",
			"iconPng": "icons/bird-icon.png",
			"svg": '<svg class="mode-toggle-icon" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false"><path fill="currentColor" d="M51.70 9.38 L43.57 7.62 L39.20 7.12 L33.32 5.00 L29.95 5.25 L28.07 6.00 L26.70 7.25 L25.45 9.62 L24.57 12.25 L22.82 14.25 L18.07 17.62 L16.45 20.88 L15.20 25.38 L14.32 38.88 L11.95 39.88 L14.20 41.00 L14.45 45.00 L15.45 45.25 L12.20 55.25 L12.32 56.00 L13.57 56.00 L13.32 58.00 L13.70 58.50 L14.45 58.88 L15.32 58.50 L16.07 57.62 L20.82 44.50 L21.57 44.12 L23.32 44.25 L23.32 46.38 L23.82 48.50 L25.95 52.50 L26.82 53.38 L27.20 53.25 L28.57 50.50 L29.70 47.25 L30.20 42.75 L34.57 42.25 L37.57 41.25 L42.07 38.25 L46.57 34.00 L41.32 33.00 L37.70 33.00 L35.20 33.38 L31.32 34.62 L34.07 29.25 L35.70 23.50 L35.70 20.75 L34.45 15.50 L36.70 12.50 L39.95 11.12 L47.57 10.88 L50.95 10.25 L51.70 9.88 L51.45 9.62 Z"/></svg>'
		},
		[Constants.MODE_INSECT]: {
			"logo": "icons/teleinsecta-logo.png",
			"title": "Teleinsecta - Rakesh's Insect Catalogue",
			"label": "Insect",
			"icon": "icons/insect-icon.svg",
			"iconPng": "icons/insect-icon.png",
			"svg": '<svg class="mode-toggle-icon" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false"><path fill="currentColor" d="M39.85 6.50 L39.60 9.38 L39.22 8.88 L38.97 6.88 L38.60 6.50 L38.60 9.62 L38.10 10.00 L37.85 10.88 L36.47 9.50 L33.35 9.62 L33.72 9.00 L33.60 8.12 L35.10 5.75 L34.97 5.50 L33.35 7.00 L33.22 6.75 L33.97 5.75 L33.72 5.62 L31.35 8.25 L30.60 9.88 L30.60 11.25 L28.22 12.75 L26.60 14.25 L23.97 18.00 L23.97 18.38 L25.60 18.38 L26.97 18.00 L27.47 18.25 L23.60 19.88 L21.60 21.38 L21.22 21.38 L19.22 19.50 L19.97 16.50 L20.22 13.75 L21.10 12.25 L20.47 12.25 L20.22 11.88 L19.35 12.25 L18.97 11.88 L17.60 17.12 L17.35 20.12 L19.35 23.62 L17.35 26.62 L16.10 29.38 L13.97 28.62 L13.97 25.62 L13.35 22.12 L13.72 19.62 L13.10 19.75 L12.60 19.25 L11.97 19.75 L11.72 19.25 L11.47 19.38 L11.72 25.12 L12.35 29.38 L15.47 32.12 L15.22 37.88 L15.85 40.88 L14.60 43.75 L13.97 47.62 L14.85 50.00 L16.72 53.50 L16.35 54.38 L16.72 55.50 L17.72 55.62 L18.35 55.38 L18.72 55.62 L18.97 55.12 L18.35 52.62 L15.85 47.62 L15.85 47.12 L17.47 44.50 L20.47 47.88 L22.72 49.25 L24.85 50.00 L26.60 50.25 L30.35 50.12 L33.35 49.25 L35.10 48.25 L35.35 48.38 L35.35 52.12 L30.97 55.25 L28.97 57.25 L28.97 58.00 L29.47 57.88 L29.72 58.38 L30.60 58.00 L30.97 58.38 L31.60 57.75 L31.72 56.75 L32.35 56.12 L35.22 54.25 L37.35 52.12 L38.22 49.12 L38.47 45.62 L40.97 42.12 L42.35 38.75 L43.10 38.25 L46.85 37.50 L48.72 35.25 L51.10 31.00 L52.35 29.62 L52.35 28.75 L51.85 29.12 L51.60 28.50 L50.72 29.12 L50.35 28.62 L49.85 29.38 L49.60 30.88 L47.72 33.12 L45.72 36.38 L43.22 36.00 L43.35 30.50 L43.10 29.25 L46.22 27.50 L47.10 26.62 L48.85 22.00 L49.47 18.88 L48.85 19.00 L48.22 18.62 L47.72 19.00 L47.47 18.62 L47.22 18.75 L47.35 20.50 L46.35 22.75 L45.60 25.75 L45.22 26.12 L42.60 26.75 L40.60 23.12 L40.72 22.38 L41.47 22.88 L41.72 22.75 L41.72 20.88 L40.97 16.38 L39.47 13.50 L40.47 11.25 L40.47 9.12 Z"/></svg>'
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
		[Constants.EXPLORE_MENU]: { name: "Explore" },
		[Constants.EXPLORE_PAGE]: { name: "Explore" },
		[Constants.MAP_MENU]: { name: "Map" },
		[Constants.MAP]: { name: "Map" },
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
		'M': '♂ Male',
		'F': '♀ Female'
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
	static DEFAULT_CAMERA_MODEL = "S7RV+200600";

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