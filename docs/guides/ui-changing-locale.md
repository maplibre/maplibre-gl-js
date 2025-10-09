# Changing The Locale Of The UI

MapLibre contains a few text prompts and tooltips within it's
default user interface and bundled controls.

By default, these text strings are in English, see the [full list here][1].

In order to translate these strings, the user must provide their own
translations, and load them when the [MapOptions][2] are initialized.

## Creating a translation file

1. Find the most up to date default locale strings [here][1].

2. Copy the contents to new files `[iso-code].ts`, such as `ne.ts` for Nepali.

!!! note
    The translation files can be stored anywhere in the project, e.g.
    `src/assets/maplibre-translations`.

3. Translate all the strings in each file:

```ts
export const ne = {
	'AttributionControl.ToggleAttribution': 'श्रेय टगल गर्नुहोस्',
	'AttributionControl.MapFeedback': 'नक्सा प्रतिकृया',
	'FullscreenControl.Enter': 'पूर्ण पर्दा खोल्नुहोस्',
	'FullscreenControl.Exit': 'पूर्ण पर्दाबाट बाहिर निस्कनुहोस्',
	'GeolocateControl.FindMyLocation': 'मेरो स्थान फेला पार्नुहोस्',
	'GeolocateControl.LocationNotAvailable': 'स्थान उपलब्ध छैन',
	'LogoControl.Title': 'MapLibre लोगो',
	'Map.Title': 'नक्सा',
	'Marker.Title': 'नक्सा मार्कर',
	'NavigationControl.ResetBearing': 'उत्तरतिर दिशा पुन: सेट गर्नुहोस्',
	'NavigationControl.ZoomIn': 'जुम बढाउनुहोस्',
	'NavigationControl.ZoomOut': 'जुम घटाउनुहोस्',
	'Popup.Close': 'पपअप बन्द गर्नुहोस्',
	'ScaleControl.Feet': 'फुट',
	'ScaleControl.Meters': 'मिटर',
	'ScaleControl.Kilometers': 'किलोमिटर',
	'ScaleControl.Miles': 'माइल',
	'ScaleControl.NauticalMiles': 'समुद्री माइल',
	'GlobeControl.Enable': 'ग्लोब सक्षम गर्नुहोस्',
	'GlobeControl.Disable': 'ग्लोब अक्षम गर्नुहोस्',
	'TerrainControl.Enable': 'भूभाग सक्षम गर्नुहोस्',
	'TerrainControl.Disable': 'भूभाग अक्षम गर्नुहोस्',
	'CooperativeGesturesHandler.WindowsHelpText': 'नक्सामा जुम गर्न Ctrl + स्क्रोल प्रयोग गर्नुहोस्',
	'CooperativeGesturesHandler.MacHelpText': 'नक्सामा जुम गर्न ⌘ + स्क्रोल प्रयोग गर्नुहोस्',
	'CooperativeGesturesHandler.MobileHelpText': 'नक्सा सार्न दुई औंला प्रयोग गर्नुहोस्',
};
```

4. Make the files accessible as exports (in this case I have Nepali and Brazilian Portuguese):

`$assets/maplibre-translations/index.ts`
```ts
import { ptBR } from './pt-BR';
import { ne } from './ne';

export { ptBR, ne };
```

5. Import the variable into the code where you instantiate the maplibre map:

`map.ts`
```ts
import { defaultLocale } from 'maplibre-gl/src/ui/default_locale';
import { ptBR, ne } from '$assets/maplibre-translations';
```

6. (Optional) Dynamically select the locale based on a locale switcher.
   This example uses Svelte, but could be any framework or vanilla JS:

```ts
// Within my store, I have a variable `locale` that contains the currently loaded locale
const commonStore = getCommonStore();

// Map the locale iso codes to the actual translation objects
const localeMap: Record<string, Record<string, string>> = {
    'en': defaultLocale,
    'pt-BR': ptBR,
    ne,
};

// Dynamically select the locale to load into MapLibre
let maplibreLocale = $derived({ ...defaultLocale, ...(localeMap[commonStore.locale] ?? localeMap['en']) });
```

!!! note
    If a string is missing from your custom locale, MapLibre will fall
    back to the English default.

7. Include the `locale` object when you instantiate maplibre:

```ts
new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/globe.json',
    center: [0, 0],
    zoom: 2,
    locale: maplibreLocale,  // Use the variable here
});
```

[1]: https://github.com/maplibre/maplibre-gl-js/blob/main/src/ui/default_locale.ts
[2]: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#locale
