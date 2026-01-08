export const DEFAULT_AWARDS = [
    // IRL Awards
    {
        name: "Site Hopper",
        requirement: "Met someone from each site",
        category: "irl",
        iconName: "BuildingOfficeIcon",

        isDynamic: true,
        dynamicType: "site_count",
        threshold: 5
    },
    {
        name: "Globetrotter",
        requirement: "Met someone from each member state",
        category: "irl",
        iconName: "GlobeAltIcon",

        isDynamic: true,
        dynamicType: "country_count",
        threshold: 23
    },
    {
        name: "Directorate Guru",
        requirement: "Met someone from each directorate",
        category: "irl",
        iconName: "IdentificationIcon",

        isDynamic: true,
        dynamicType: "directorate_count",
        threshold: 12
    },
    {
        name: "Socialite",
        requirement: "Met more than 10 colleagues",
        category: "irl",
        iconName: "UserGroupIcon",

        isDynamic: true,
        dynamicType: "encounter_count",
        threshold: 10
    },
    {
        name: "Connector",
        requirement: "Met more than 50 colleagues",
        category: "irl",
        iconName: "UsersIcon",

        isDynamic: true,
        dynamicType: "encounter_count",
        threshold: 50
    },

    // Pin Awards
    {
        name: "Collector",
        requirement: "Collected more than 10 pins",
        category: "pin",
        iconName: "TicketIcon",

        isDynamic: true,
        dynamicType: "pin_count",
        threshold: 10
    },
    {
        name: "Hoarder",
        requirement: "Collected more than 50 pins",
        category: "pin",
        iconName: "SparklesIcon",

        isDynamic: true,
        dynamicType: "pin_count",
        threshold: 50
    },
    {
        name: "Legendary",
        requirement: "Collected a legendary pin",
        category: "pin",
        iconName: "MagnifyingGlassCircleIcon",

        isDynamic: true,
        dynamicType: "has_legendary_pin",
        threshold: 1
    },

    // Club Awards
    {
        name: "Newbie",
        requirement: "Join your first club",
        category: "club",
        iconName: "PlusCircleIcon",

        isDynamic: true,
        dynamicType: "club_count",
        threshold: 1
    },
    {
        name: "Social Butterfly",
        requirement: "Joined 5 clubs",
        category: "club",
        iconName: "HashtagIcon",

        isDynamic: true,
        dynamicType: "club_count",
        threshold: 5
    },
    {
        name: "Club Legend",
        requirement: "Joined 10 clubs",
        category: "club",
        iconName: "RocketLaunchIcon",

        isDynamic: true,
        dynamicType: "club_count",
        threshold: 10
    },
    {
        name: "The Visionary",
        requirement: "Club founder",
        category: "club",
        iconName: "FlagIcon",

        isDynamic: false
    },
    {
        name: "The Shepherd",
        requirement: "Club manager",
        category: "club",
        iconName: "WrenchScrewdriverIcon",

        isDynamic: false
    },

    // Young ESA Awards
    {
        name: "Part of the Crew",
        requirement: "Belonging to a group",
        category: "special",
        iconName: "UserGroupIcon",

        isDynamic: false
    },
    {
        name: "Skipper",
        requirement: "Leading a group",
        category: "special",
        iconName: "RocketLaunchIcon",

        isDynamic: false
    },
    {
        name: "Expedition Leader",
        requirement: "Trip organizer",
        category: "special",
        iconName: "GlobeAltIcon",

        isDynamic: false
    },
    {
        name: "Star Guide",
        requirement: "Open days benevol",
        category: "special",
        iconName: "SparklesIcon",

        isDynamic: false
    },
];
