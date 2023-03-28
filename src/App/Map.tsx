import React from "react";
// @ts-ignore
import geojsonExtent from '@mapbox/geojson-extent'
import toGeoJson from './toGeoJson'
import setCluster from './setCluster'
import Shop from './Shop'

type Props = {
  data: Pwamap.ShopData[];
};

const CSS: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
}

const hidePoiLayers = (map: any) => {

  const hideLayers = [
    'poi',
    'poi-primary',
    'poi-r0-r9',
    'poi-r10-r24',
    'poi-r25',
    'poi-bus',
    'poi-entrance',
  ]

  for (let i = 0; i < hideLayers.length; i++) {
    const layerId = hideLayers[i];
    map.setLayoutProperty(layerId, 'visibility', 'none')
  }
}

const parseHash = (url?: Location | URL) => {
  const qstr = (url || window.location).hash.substring(2);
  const q = new URLSearchParams(qstr);
  return q;
};

const updateHash = (q: URLSearchParams) => {

  const hash = q.toString();
  if (hash) {
    window.location.hash = `#/?${q.toString().replace(/%2F/g, '/')}`;
  }
};

const Content = (props: Props) => {
  const mapNode = React.useRef<HTMLDivElement>(null);
  const [mapObject, setMapObject] = React.useState<any>()
  const [shop, setShop] = React.useState<Pwamap.ShopData | undefined>(undefined)
  const [ zLatLngString, setZLatLngString ] = React.useState<string>('');

  const addMarkers = (mapObject: any, data: any) => {

    if (!mapObject || !data) {
      return
    }

    mapObject.on('render', () => {

      // nothing to do if shops exists.
      if (mapObject.getSource('shops')) {
        return
      }

      hidePoiLayers(mapObject)

      const textColor = '#000000'
      const textHaloColor = '#FFFFFF'

      const geojson: any = toGeoJson(data)

      mapObject.addSource('shops', {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 25,
      })

      geojson.features.forEach(function (feature: any) {
        let category:string = feature.properties['カテゴリ'];
        console.log(category)
        let layer_id: string = "";
        let symbol: string = 'commercial';
        if (category === "センキョ割実施店舗") {
          layer_id = 'poi-shop';
          symbol = 'commercial';
        } else if (category === "期日前投票所") {
          layer_id = 'poi-early-voting-station';
          symbol = 'town_hall';
        } else if (category === "投票所") {
          layer_id = 'poi-voting-station';
          symbol = 'monument';
        } else if (category === "ポスター掲示場設置場所") {
          layer_id = 'poi-poster-location';
          symbol = 'amusement_park';
        } else {
          layer_id = "";
          symbol = "";
        }
        // Add a layer for this symbol type if it hasn't been added already.
        if (!mapObject.getLayer(layer_id)) {
          mapObject.addLayer({
            'id': layer_id,
            'type': 'symbol',
            source: 'shops',
            filter: ['==', "カテゴリ", category],
            'layout': {
              'icon-image': symbol,
              'icon-overlap': 'always',
              'icon-size': 1.7
            },
          });

          mapObject.on('mouseenter', layer_id, () => {
            mapObject.getCanvas().style.cursor = 'pointer'
          })
    
          mapObject.on('mouseleave', layer_id, () => {
            mapObject.getCanvas().style.cursor = ''
          })
    
          mapObject.on('click', layer_id, (event: any) => {
            if (!event.features[0].properties.cluster) {
              setShop(event.features[0].properties)
            }
          })    
        }
      });

      mapObject.addLayer({
        id: 'shop-symbol',
        type: 'symbol',
        source: 'shops',
        filter: ['all',
          ['==', '$type', 'Point'],
        ],
        paint: {
          'text-color': textColor,
          'text-halo-color': textHaloColor,
          'text-halo-width': 2,
        },
        layout: {
          'text-field': "{スポット名}",
          'text-font': ['Noto Sans Regular'],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.5,
          'text-justify': 'auto',
          'text-size': 12,
          'text-anchor': 'top',
          'text-max-width': 12,
          'text-allow-overlap': false,
        },
      })

      // shop-symbol
      mapObject.on('mouseenter', 'shop-symbol', () => {
        mapObject.getCanvas().style.cursor = 'pointer'
      })

      mapObject.on('mouseleave', 'shop-symbol', () => {
        mapObject.getCanvas().style.cursor = ''
      })

      mapObject.on('click', 'shop-symbol', (event: any) => {
        if (!event.features[0].properties.cluster) {
          setShop(event.features[0].properties)
        }
      })

      setCluster(mapObject)

    });

  }

  React.useEffect(() => {

    addMarkers(mapObject, props.data)

  }, [mapObject, props.data])

  React.useEffect(() => {
    const hash = parseHash();
    if (zLatLngString) {
      hash.set('map', zLatLngString);
    }
    updateHash(hash);

  }, [ zLatLngString ]);

  React.useEffect(() => {
    // Only once reder the map.
    if (!mapNode.current || mapObject) {
      return
    }

    // @ts-ignore
    const { geolonia } = window;

    const geojson = toGeoJson(props.data)
    const bounds = geojsonExtent(geojson)

    const map = new geolonia.Map({
      container: mapNode.current,
      style: 'geolonia/gsi',
      bounds: bounds,
      fitBoundsOptions: { padding: 50 },
    });

    const hash = parseHash();
    if (hash && hash.get('map')) {

      const latLngString = hash.get('map') || '';
      const zlatlng = latLngString.split('/');

      const zoom = zlatlng[0]
      const lat = zlatlng[1]
      const lng = zlatlng[2]

      map.flyTo({center: [lng, lat], zoom});

    } else if (bounds) {

      map.fitBounds(bounds, { padding: 50 })

    }

    const onMapLoad = () => {
      hidePoiLayers(map)
      setMapObject(map)

      map.on('moveend', () => {
        // see: https://github.com/maplibre/maplibre-gl-js/blob/ba7bfbc846910c5ae848aaeebe4bde6833fc9cdc/src/ui/hash.js#L59
        const center = map.getCenter(),
          rawZoom = map.getZoom(),
          zoom = Math.round(rawZoom * 100) / 100,
          // derived from equation: 512px * 2^z / 360 / 10^d < 0.5px
          precision = Math.ceil((zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10),
          m = Math.pow(10, precision),
          lng = Math.round(center.lng * m) / m,
          lat = Math.round(center.lat * m) / m,
          zStr = Math.ceil(zoom);

        setZLatLngString(`${zStr}/${lat}/${lng}`);
      });
    }

    const orienteationchangeHandler = () => {
      map.resize()
    }

    // attach
    map.on('load', onMapLoad)

    window.addEventListener('orientationchange', orienteationchangeHandler)

    return () => {
      // detach to prevent memory leak
      window.removeEventListener('orientationchange', orienteationchangeHandler)
      map.off('load', onMapLoad)
    }
  }, [mapNode, mapObject, props.data])

  const closeHandler = () => {
    setShop(undefined)
  }

  return (
    <div style={CSS}>
      <div
        ref={mapNode}
        style={CSS}
        data-geolocate-control="on"
        data-marker="off"
        data-gesture-handling="off"
      ></div>
      {shop ?
        <Shop shop={shop} close={closeHandler} />
        :
        <></>
      }
    </div>
  );
};

export default Content;
