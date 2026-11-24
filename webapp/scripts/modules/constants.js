export default class Constants {
	static ADMIN_USE_ETAG = true;
	static MODE_BIRD = "bird";
	static MODE_INSECT = "insect";
	static MODE_REPTILE = "reptile";
	static DEFAULT_MODE = Constants.MODE_BIRD;

	// Ordered list of modes for the toggle UI (extensible — add new modes here and in MODE)
	static MODES = [Constants.MODE_BIRD, Constants.MODE_INSECT, Constants.MODE_REPTILE];

	static normalizeMode(mode) {
		if (!mode) return Constants.DEFAULT_MODE;
		const m = mode.toLowerCase();
		if (m === 'reptile' || m === 'reptiles' || m === 'reptiles_amphibians' || m === 'herp') {
			return Constants.MODE_REPTILE;
		}
		if (m === 'insect' || m === 'insects') {
			return Constants.MODE_INSECT;
		}
		if (m === 'bird' || m === 'birds') {
			return Constants.MODE_BIRD;
		}
		return Constants.MODE[m] ? m : Constants.DEFAULT_MODE;
	}

	static getDefaultSpecies(mode) {
		const m = Constants.normalizeMode(mode);
		return Constants.MODE[m]?.defaultSpecies || "";
	}

	static MODE = {
		[Constants.MODE_BIRD]: {
			"logo": "icons/telebirding-logo.png",
			"title": "Telebirding - Rakesh's Birds Catalogue",
			"label": "Birds",
			"defaultSpecies": "",
			"icon": "icons/bird-icon.svg",
			"iconPng": "icons/bird-icon.png",
			"svg": '<svg class="mode-toggle-icon" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false"><path fill="currentColor" d="M51.70 9.38 L43.57 7.62 L39.20 7.12 L33.32 5.00 L29.95 5.25 L28.07 6.00 L26.70 7.25 L25.45 9.62 L24.57 12.25 L22.82 14.25 L18.07 17.62 L16.45 20.88 L15.20 25.38 L14.32 38.88 L11.95 39.88 L14.20 41.00 L14.45 45.00 L15.45 45.25 L12.20 55.25 L12.32 56.00 L13.57 56.00 L13.32 58.00 L13.70 58.50 L14.45 58.88 L15.32 58.50 L16.07 57.62 L20.82 44.50 L21.57 44.12 L23.32 44.25 L23.32 46.38 L23.82 48.50 L25.95 52.50 L26.82 53.38 L27.20 53.25 L28.57 50.50 L29.70 47.25 L30.20 42.75 L34.57 42.25 L37.57 41.25 L42.07 38.25 L46.57 34.00 L41.32 33.00 L37.70 33.00 L35.20 33.38 L31.32 34.62 L34.07 29.25 L35.70 23.50 L35.70 20.75 L34.45 15.50 L36.70 12.50 L39.95 11.12 L47.57 10.88 L50.95 10.25 L51.70 9.88 L51.45 9.62 Z"/></svg>'
		},
		[Constants.MODE_INSECT]: {
			"logo": "icons/telebirding-logo.png",
			"title": "Telebirding - Rakesh's Insects Catalogue",
			"label": "Insects",
			"defaultSpecies": "",
			"icon": "icons/insect-icon.svg",
			"iconPng": "icons/insect-icon.png",
			"svg": '<svg class="mode-toggle-icon" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false"><path fill="currentColor" d="M46.66 12.14 L44.73 12.07 L42.95 13.11 L37.38 19.34 L31.37 24.09 L29.07 26.91 L28.18 29.14 L28.10 31.74 L30.85 40.05 L28.77 37.60 L27.21 33.97 L24.61 33.74 L22.16 34.56 L18.23 36.94 L15.63 39.31 L13.92 41.84 L13.48 43.32 L13.78 45.62 L16.52 48.29 L22.61 50.22 L32.04 50.97 L29.66 51.41 L27.66 53.12 L25.88 55.94 L26.02 57.50 L27.51 56.76 L29.44 54.16 L31.59 52.38 L34.41 51.26 L40.20 50.22 L43.40 48.74 L45.47 46.07 L47.70 45.62 L48.00 43.91 L51.34 39.91 L51.41 39.16 L50.74 39.02 L50.15 41.02 L47.92 43.54 L46.59 43.54 L44.66 45.03 L43.99 44.58 L42.88 45.84 L45.33 41.98 L47.63 36.79 L49.26 31.44 L50.37 25.28 L50.52 20.23 L49.93 16.82 L48.52 13.70 Z M41.61 7.24 L40.28 6.57 L39.02 6.50 L37.38 7.32 L35.45 9.69 L32.26 15.04 L28.10 19.49 L26.10 22.16 L25.13 24.17 L24.69 26.32 L24.98 28.92 L26.10 31.29 L22.24 31.37 L20.38 32.19 L18.16 33.82 L15.48 36.42 L13.85 38.64 L13.03 40.28 L12.59 42.21 L13.18 40.72 L14.74 38.57 L16.74 36.64 L19.34 34.78 L23.50 32.78 L27.06 32.63 L26.84 31.52 L27.06 28.77 L28.10 26.25 L29.14 24.76 L31.96 22.02 L36.57 18.53 L42.21 12.22 L44.21 11.03 L43.17 8.95 Z"/></svg>'
		},
		[Constants.MODE_REPTILE]: {
			"logo": "icons/telebirding-logo.png",
			"title": "Telebirding - Rakesh's Reptiles & Amphibians Catalogue",
			"label": "Reptiles & Amphibians",
			"defaultSpecies": "unidentified-lizard",
			"icon": "icons/reptile-icon.svg",
			"iconPng": "icons/reptile-icon.png",
			"svg": '<svg class="mode-toggle-icon" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false"><path fill="currentColor" d="M51.98 11.36 L50.24 10.10 L48.80 9.32 L48.02 9.08 L47.12 9.20 L46.52 9.56 L46.04 10.04 L45.44 10.94 L44.72 12.56 L44.06 15.02 L43.88 15.32 L43.10 14.66 L42.80 13.58 L41.96 11.78 L41.12 10.46 L40.40 9.68 L39.56 9.92 L37.82 11.00 L36.50 8.78 L35.54 7.76 L35.00 7.76 L34.58 7.94 L32.78 9.26 L32.48 9.32 L30.38 7.88 L29.66 7.52 L29.06 7.40 L28.58 7.58 L28.16 7.94 L27.14 9.56 L26.60 9.56 L24.26 8.72 L23.24 8.66 L22.76 9.14 L22.28 10.58 L21.98 11.06 L20.96 11.24 L18.44 11.30 L18.14 11.96 L18.02 13.64 L16.40 13.82 L15.50 14.06 L15.38 14.54 L15.44 16.04 L12.38 17.54 L11.42 18.26 L11.54 18.86 L12.14 19.70 L12.08 19.88 L10.64 21.02 L9.80 21.86 L9.20 22.70 L9.14 23.78 L9.44 24.92 L8.18 27.56 L6.92 30.74 L6.02 33.68 L5.42 36.32 L5.00 39.56 L5.00 42.56 L5.30 44.60 L5.66 45.98 L6.32 47.78 L7.46 49.94 L8.96 51.98 L10.82 53.78 L12.74 55.10 L14.24 55.82 L16.40 56.42 L17.48 56.54 L18.98 56.48 L19.94 56.30 L21.32 55.82 L22.16 55.40 L23.54 54.44 L24.38 53.60 L25.40 51.98 L25.88 50.42 L26.00 48.92 L25.82 47.48 L25.28 45.86 L24.56 44.60 L23.36 43.22 L22.04 42.26 L20.30 41.54 L19.34 41.36 L17.42 41.42 L16.10 41.84 L15.08 42.44 L14.00 43.46 L13.16 44.84 L12.80 45.98 L12.74 47.42 L13.22 48.92 L13.64 49.52 L14.78 50.48 L15.92 51.02 L16.94 51.32 L18.80 51.32 L19.76 50.84 L20.48 49.94 L20.72 49.16 L20.72 48.26 L20.48 47.54 L19.94 46.94 L18.74 46.52 L18.08 46.64 L17.90 46.88 L17.90 47.36 L18.08 47.54 L18.86 47.84 L19.10 48.08 L19.10 48.56 L18.92 48.92 L18.32 49.40 L17.96 49.52 L17.12 49.40 L16.58 49.10 L16.04 48.56 L15.80 48.02 L15.68 47.24 L15.98 45.92 L16.34 45.32 L16.88 44.78 L17.72 44.30 L18.38 44.12 L19.76 44.12 L20.30 44.24 L21.44 44.84 L22.28 45.74 L22.88 46.88 L23.12 47.84 L23.18 49.22 L22.94 50.42 L22.46 51.44 L21.50 52.52 L20.84 52.94 L19.52 53.36 L17.66 53.42 L16.10 53.12 L14.00 52.22 L12.62 51.26 L11.30 49.94 L10.34 48.56 L9.50 46.70 L9.14 45.08 L9.08 44.18 L9.20 42.80 L9.86 40.58 L10.82 38.78 L12.14 37.04 L14.00 35.18 L15.56 33.92 L18.20 32.24 L19.46 31.58 L19.88 31.64 L21.20 32.24 L22.58 33.20 L24.80 35.42 L26.00 36.44 L27.08 37.16 L27.86 37.52 L29.30 37.94 L31.28 38.24 L33.08 38.30 L35.06 38.12 L36.38 37.76 L37.22 37.22 L37.46 36.68 L37.22 35.90 L36.62 35.36 L35.36 34.88 L31.88 34.22 L30.62 33.74 L29.54 32.66 L28.10 30.50 L27.08 29.36 L27.02 29.06 L30.86 28.22 L33.74 27.74 L33.98 27.80 L34.10 28.46 L34.82 29.54 L35.90 30.38 L37.52 31.22 L39.38 31.88 L41.12 32.30 L43.70 32.60 L45.02 32.54 L45.86 32.36 L46.34 32.12 L46.76 31.64 L46.76 30.98 L46.58 30.62 L46.04 30.08 L45.50 29.72 L43.58 28.82 L41.42 28.10 L39.32 27.62 L39.20 27.50 L39.68 27.02 L40.34 26.90 L46.04 26.48 L50.78 26.36 L54.32 26.00 L56.30 25.58 L58.04 24.80 L58.46 24.38 L58.88 23.42 L58.94 21.62 L58.52 19.88 L57.92 18.32 L57.26 17.06 L55.70 14.96 L53.18 12.38 Z"/></svg>'
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
		},
		[Constants.MODE_REPTILE]: {
			'': 'Adult',
			'Juvenile': 'Juvenile',
			'Hatchling': 'Hatchling',
			'Tadpole': 'Tadpole'
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
		},
		[Constants.MODE_REPTILE]: {
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
		},
		[Constants.MODE_REPTILE]: {
			"0": "-",
			"1": "Got the Reptile",
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
	static DEFAULT_DESCRIPTION = "Rakesh's Birds Catalogue";

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