let dummyTags = [
    'flower',
    'rose',
    'red',
    'nature',
    'plant',
    'car',
    'vehicle',
    'automobile',
    'road',
    'street',
    'building',
    'architecture',
    'city',
    'town',
    'sky',
    'cloud',
    'party',
    'celebration',
    'birthday',
    'cake',
    'food',
    'fruit',
    'apple',
    'banana',
    'mango',
    'watermelon',
    'grapes',
    'orange',
    'lemon',
    'juice',
    'drink',
    'water',
    'sea',
    'ocean',
    'beach',
    'sand',
    'mountain',
    'hill',
    'snow',
    'winter',
    'summer',
    'spring',
    'autumn',
    'fall',
    'tree',
    'forest',
    'wood',
    'metal',
    'iron',
    'gold',
    'silver',
    'copper',
    'bronze',
    'aluminium',
    'steel',
    'plastic',
    'rubber',
    'glass',
    'ceramic',
    'paper',
    'cardboard',
    'fabric',
    'cloth',
    'cotton',
    'silk',
    'wool',
    'leather',
    'fur',
    'skin',
    'hair',
    'feather',
    'computer',
    'laptop',
    'mobile',
    'phone',
    'smartphone',
    'tablet',
    'ipad',
    'iphone',
    'door',
    'window',
    'table',
    'chair',
    'sofa',
    'couch',
    'bed',
    'lamp',
    'light',
    'fan',
    'air conditioner',
    'tv',
    'television',
    'radio',
    'music',
    'song',
    'dance',
    'dancer',
    'actor',
    'actress',
    'movie',
    'film',
    'cinema',
    'theatre',
    'play',
    'game',
    'video game',
    'board game',
    'card game',
    'chess',
    'checkers',
    'football',
    'soccer',
    'cricket',
    'tennis',
    'badminton',
    'basketball',
    'volleyball',
    'baseball',
    'hockey',
    'golf',
    'rugby',
    'bowling',
    'swimming',
    'running',
    'jogging',
    'walking',
    'cycling',
    'biking',
    'hiking',
    'climbing',
    'mountaineering',
    'skiing',
    'skating',
    'skateboarding',
    'surfing',
    'diving',
    'fishing',
    'camping',
    'farming',
    'gardening',
    'cooking',
    'baking',
    'eating',
    'drinking',
    'sleeping',
    'pet',
    'animal',
    'bird',
    'dog',
    'cat'
];
dummyTags = [...new Set(dummyTags)];
dummyTags.sort();

const getRandomIntInclusive = function (min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
};

const getDummyTags = async function () {
    const rand = getRandomIntInclusive(5, 25);

    let tags = [];

    for (let i = 0; i < rand; i++) {
        const tag = dummyTags[getRandomIntInclusive(0, dummyTags.length - 1)];
        tags.push(tag);
    }

    tags = [...new Set(tags)];
    tags.sort();

    return tags;
};

export { getDummyTags };
