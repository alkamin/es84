import { useRafState, useHash } from "react-use";
import styles from "../styles/Home.module.css";
import { StaticMap, ViewportProps } from "react-map-gl";
import DeckGL from "@deck.gl/react";
import { MVTLayer } from "@deck.gl/geo-layers";
import { GeoJsonLayer } from "@deck.gl/layers";
import { useEffect, useState } from "react";
import { Option, some, none, fold, isNone, exists } from "fp-ts/Option";
import { pipe } from "fp-ts/pipeable";
import {
  Spinner,
  Button,
  Card,
  Row,
  Text,
  Description,
  Spacer,
  Loading,
  Pagination,
} from "@geist-ui/react";

import axios from "axios";
import wellknown from "../lib/wellknown";
import SearchResultItem from "../components/SearchResultItem";
import buffer from "@turf/buffer";
import centroid from "@turf/centroid";

type Viewport = Partial<Omit<ViewportProps, "width" | "height">> & {
  width: number | string;
  height: number | string;
};
const MIN_GRID_ZOOM = 3;
const PAGE_SIZE = 50;
const SEARCH_API =
  "https://earth-search.aws.element84.com/v0/collections/sentinel-s2-l2a-cogs/items";

const defaultViewport: Viewport = {
  width: "100%",
  height: "100vh",
  latitude: 0,
  longitude: 0,
  zoom: 2,
};

const mvtGridProps = {
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

const geoJsonResultsProps = {
  stroked: true,
  filled: true,
  lineWidthMinPixels: 4,
  getLineColor: [248, 28, 229, 255],
  getFillColor: [248, 28, 229, 0],
  highlightColor: [248, 28, 229, 128],
  uniqueIdProperty: "id",
};

const mergeHash = (hash: string, viewport: Viewport): Viewport => {
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

const extractHash = (viewport: Viewport): string =>
  `${viewport.zoom}/${viewport.latitude}/${viewport.longitude}`;

export default function Home() {
  if (typeof window === "undefined") return <Spinner />;

  const [hash, setHash] = useHash();
  const [viewportOption, setViewportOption] = useRafState<
    Option<Partial<Viewport>>
  >(none);
  const [selectedCellOption, setSelectedCellOption] = useState<Option<any>>(
    none
  );
  const [searchResultsOption, setSearchResultsOption] = useState<Option<any>>(
    none
  );
  const [hoveredResultOption, setHoveredResultOption] = useState<Option<any>>(
    none
  );
  const [page, setPage] = useState<number>(-1);

  const highlightedGridId = pipe(
    selectedCellOption,
    fold(
      () => null,
      (cell) => cell?.properties?.id || null
    )
  );

  const highlightedResultId = pipe(
    hoveredResultOption,
    fold(
      () => null,
      (cell) => cell.id
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
          const geom = buffer(
            centroid(wellknown(selectedCell.properties.llWkt)),
            10,
            { units: "miles" }
          ).geometry;
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
              {...mvtGridProps}
              highlightedFeatureId={highlightedGridId}
            />
            <StaticMap
              reuseMaps
              mapboxApiAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
              mapStyle="mapbox://styles/akaminsky30/ckeybe3r90rxj1apli1m1oafe"
              width={viewport.width}
              height={viewport.height}
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
                    {pipe(
                      searchResultsOption,
                      fold(
                        () => null,
                        (results) =>
                          results?.features?.length && (
                            <div className={styles.resultsScrollContainer}>
                              <div className={styles.resultsContainer}>
                                {results.features.map((result, key) => (
                                  <SearchResultItem
                                    result={result}
                                    key={key}
                                    onHover={(result) =>
                                      setHoveredResultOption(some(result))
                                    }
                                    onLeave={() => setHoveredResultOption(none)}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                      )
                    )}
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
