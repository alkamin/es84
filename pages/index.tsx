import { useRafState, useHash } from "react-use";
import styles from "../styles/Home.module.css";
import { StaticMap, ViewportProps } from "react-map-gl";
import DeckGL from "@deck.gl/react";
import { MVTLayer } from "@deck.gl/geo-layers";
import { GeoJsonLayer } from "@deck.gl/layers";
import { useEffect, useState } from "react";
import {
  Option,
  some,
  none,
  fold,
  isNone,
  exists,
  filterMap,
} from "fp-ts/Option";
import { pipe } from "fp-ts/pipeable";
import {
  Spinner,
  Fieldset,
  Button,
  Card,
  Row,
  Col,
  Text,
  Description,
  Spacer,
  Divider,
  Loading,
  Image,
  Display,
  Pagination,
  useClipboard,
  Input,
} from "@geist-ui/react";
import { Star } from "@geist-ui/react-icons";

import axios from "axios";
import wellknown from "../lib/wellknown";
import { format } from "date-fns";
import SearchResultItem from "../components/SearchResultItem";

const MIN_GRID_ZOOM = 3;
const PAGE_SIZE = 50;
const SEARCH_API =
  "https://earth-search.aws.element84.com/v0/collections/sentinel-s2-l2a-cogs/items";

const defaultViewport: ViewportProps = {
  width: "100%",
  height: "100vh",
  latitude: 0,
  longitude: 0,
  zoom: 2,
};

const mvtProps = {
  data: `/grid1/{z}/{x}/{y}.pbf`,
  minZoom: MIN_GRID_ZOOM,
  maxZoom: 4,
  getLineWidth: 10,
  lineWidthMinPixels: 2,
  getLineColor: [61, 161, 209, 128],
  getFillColor: [61, 161, 209, 0],
  pickable: true,
  highlightColor: [61, 161, 209, 128],
  uniqueIdProperty: "id",
};

const mergeHash = (hash: string, viewport: ViewportProps): ViewportProps => {
  const [zoom, latitude, longitude] = hash
    ?.slice(1)
    .split("/")
    .map((s) => +s);
  if (!isNaN(zoom) && !isNaN(latitude) && !isNaN(longitude)) {
    return {
      ...viewport,
      zoom,
      latitude,
      longitude,
    };
  }
  return viewport;
};

const extractHash = (viewport: ViewportProps): string =>
  `${viewport.zoom}/${viewport.latitude}/${viewport.longitude}`;

const getVsiPath = (url: string) =>
  url.startsWith("s3")
    ? url.replace("s3://", "/vsis3/")
    : url.replace("http://", "/vsicurl/").replace("https://", "/vsicurl/");

const generateCommand = (name, result) => {
  return `AWS_DEFAULT_PROFILE=raster-foundry gdal_merge.py -co COMPRESS=DEFLATE -co PREDICTOR=2 -separate -o ${name
    .toLowerCase()
    .replaceAll(" ", "_")}.tif '${getVsiPath(
    result.assets.B04.href
  )}' '${getVsiPath(result.assets.B03.href)}' '${getVsiPath(
    result.assets.B02.href
  )}'`;
};

export default function Home() {
  if (typeof window === "undefined") return <Spinner />;

  const copy = useClipboard();
  const [hash, setHash] = useHash();
  const [viewportOption, setViewportOption] = useRafState<
    Option<ViewportProps>
  >(none);
  const [selectedCellOption, setSelectedCellOption] = useState<Option<any>>(
    none
  );
  const [searchResultsOption, setSearchResultsOption] = useState<Option<any>>(
    none
  );
  const [savedResults, setSavedResults] = useState([]);
  const [page, setPage] = useState();

  const highlightedFeatureId = pipe(
    selectedCellOption,
    fold(
      () => null,
      (cell) => cell.properties.id
    )
  );

  useEffect(() => {
    if (isNone(viewportOption)) {
      if (hash) {
        setViewportOption(some(mergeHash(hash, defaultViewport)));
      } else {
        setHash(extractHash(defaultViewport));
      }
    }
  }, [viewportOption, hash]);

  useEffect(() => {
    console.log(1);
    let isLatest = true;
    setSearchResultsOption(none);
    pipe(
      selectedCellOption,
      fold(
        () => {},
        async (selectedCell) => {
          console.log(2);
          const geom = wellknown(selectedCell.properties.llWkt);
          const resp = await axios.get(
            `${SEARCH_API}?intersects=${encodeURIComponent(
              JSON.stringify(geom)
            )}&limit=${PAGE_SIZE}&page=${page}`
          );

          isLatest && setSearchResultsOption(some(resp.data));
        }
      )
    );

    return () => {
      isLatest = false;
    };
  }, [selectedCellOption, page]);

  const onClickGrid = ({ object: nextCell }) => {
    setPage(1);
    nextCell &&
    pipe(
      selectedCellOption,
      exists(
        (selectedCell) => selectedCell.properties.id === nextCell.properties.id
      )
    )
      ? setSelectedCellOption(none)
      : setSelectedCellOption(some(nextCell));
  };

  const onClickClearSelection = () => setSelectedCellOption(none);

  const onClickToggleSave = (cell) => {
    setSavedResults((savedResults) =>
      savedResults.findIndex((sr) => sr.id === cell.id) > -1
        ? savedResults.filter((sr) => sr.id !== cell.id)
        : [...savedResults, cell]
    );
  };

  const onSubmitCommand = (values: any) => {
    console.log(values);
    return false;
  };

  return pipe(
    viewportOption,
    fold(
      () => <Spinner />,
      (viewport) => (
        <div className={styles.container}>
          <DeckGL
            initialViewState={{ ...viewport }}
            controller={true}
            getTooltip={({ object }) => object?.properties?.id}
            className={styles.mapContainer}
            onViewStateChange={({ viewState }) => {
              setViewportOption(some(viewState));
              setHash(extractHash(viewState));
            }}
            onClick={onClickGrid}
          >
            <MVTLayer
              {...mvtProps}
              highlightedFeatureId={highlightedFeatureId}
            />
            {pipe(
              searchResultsOption,
              fold(
                () => null,
                (results) => (
                  <GeoJsonLayer
                    data={results}
                    stroked={true}
                    filled={false}
                    lineWidthMinPixels={2}
                    getLineColor={[248, 28, 229, 255]}
                  />
                )
              )
            )}
            <StaticMap
              reuseMaps
              mapboxApiAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
              mapStyle="mapbox://styles/akaminsky30/ckeybe3r90rxj1apli1m1oafe"
            />
          </DeckGL>
          <div className={styles.infoContainer}>
            {pipe(
              selectedCellOption,
              fold(
                () => (
                  <>
                    {viewport.zoom >= MIN_GRID_ZOOM ? (
                      <Card shadow>
                        <Text small>
                          Select a grid cell to search for available imagery
                        </Text>
                      </Card>
                    ) : (
                      <Card shadow>
                        <Text small>Zoom in further to select a grid-cell</Text>
                      </Card>
                    )}
                  </>
                ),
                (selectedCell) => (
                  <>
                    {pipe(
                      searchResultsOption,
                      fold(
                        () => null,
                        (results) =>
                          results?.features?.length && (
                            <div className={styles.resultsScrollContainer}>
                              <div className={styles.resultsContainer}>
                                {results.features.map((result, key) => (
                                  <SearchResultItem result={result} key={key} />
                                ))}
                              </div>
                            </div>
                          )
                      )
                    )}
                    <Card
                      className={styles.searchCap}
                      style={{
                        marginBottom: "8px",
                        pointerEvents: "all",
                        zIndex: 10,
                      }}
                      shadow
                    >
                      <Card.Content>
                        <Description
                          title="Selected Grid-Cell"
                          content={
                            <Row align="middle">
                              {selectedCell.properties.id}
                              <Spacer x={1} />
                              <Button
                                onClick={onClickClearSelection}
                                size="mini"
                              >
                                Unselect
                              </Button>
                            </Row>
                          }
                        />
                      </Card.Content>
                      <Card.Footer
                        style={{ backgroundColor: "rgb(250, 250, 250)" }}
                      >
                        {pipe(
                          searchResultsOption,
                          fold(
                            () => <Loading>Loading results</Loading>,
                            (results) => (
                              <Row justify="center" style={{ width: "100%" }}>
                                <Pagination
                                  count={Math.ceil(
                                    results.context.matched /
                                      results.context.limit
                                  )}
                                  page={page}
                                  limit={4}
                                  size="mini"
                                  onChange={(nextPage) => {
                                    console.log(3, nextPage);
                                    setPage(nextPage);
                                  }}
                                />
                              </Row>
                            )
                          )
                        )}
                      </Card.Footer>
                    </Card>
                  </>
                )
              )
            )}
          </div>
        </div>
      )
    )
  );
}

// <Source type="geojson" data="/grid.geojson">
//           <Layer
//             id="grid"
//             type="line"
//             paint={{
//               "line-color": "blue",
//               "line-width": 2,
//             }}
//           />
//         </Source>
