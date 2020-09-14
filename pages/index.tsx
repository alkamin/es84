import { useRafState, useHash } from "react-use";
import styles from "../styles/Home.module.css";
import { StaticMap, ViewportProps } from "react-map-gl";
import DeckGL from "@deck.gl/react";
import { MVTLayer } from "@deck.gl/geo-layers";
import { useEffect, useState } from "react";
import { Option, some, none, fold, isNone, exists } from "fp-ts/Option";
import { pipe } from "fp-ts/pipeable";
import {
  Alert,
  AlertIcon,
  Box,
  Stack,
  Text,
  Spinner,
  Flex,
  CloseButton,
} from "@chakra-ui/core";

import axios from "axios";
import wellknown from "../lib/wellknown";
import SearchResultItem from "../components/SearchResultItem";
import buffer from "@turf/buffer";
import centroid from "@turf/centroid";
import Card from "../components/Card";

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
  const [page, setPage] = useState<number>(-1);

  const highlightedGridId = pipe(
    selectedCellOption,
    fold(
      () => null,
      (cell) => cell?.properties?.id || null
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
          <Flex
            position="absolute"
            pointerEvents="none"
            top="0"
            right="0"
            bottom="0"
            width="340px"
            padding={2}
            pb={0}
            overflowY="auto"
            align="start"
          >
            {pipe(
              selectedCellOption,
              fold(
                () => (
                  <>
                    {viewport.zoom >= MIN_GRID_ZOOM ? (
                      <Alert status="info">
                        <AlertIcon />
                        <Text fontSize="sm">
                          Select a grid cell to search for available imagery
                        </Text>
                      </Alert>
                    ) : (
                      <Alert status="info">
                        <AlertIcon />
                        <Text fontSize="sm">
                          Zoom in further to select a grid-cell
                        </Text>
                      </Alert>
                    )}
                  </>
                ),
                (selectedCell) => (
                  <>
                    <CloseButton
                      size="md"
                      onClick={onClickClearSelection}
                      bg="rgba(255,255,255,0.5)"
                      mr={2}
                      pointerEvents="all"
                    />
                    <Flex
                      flex="1 1 auto"
                      direction="column"
                      alignSelf="stretch"
                    >
                      <Card mb={2}>
                        <Card.Content>
                          {selectedCell.properties.id}
                        </Card.Content>
                        <Card.Divider />
                        <Card.Content>
                          <Flex justify="center">
                            {pipe(
                              searchResultsOption,
                              fold(
                                () => <Spinner />,
                                (results) => (
                                  <Text
                                    fontSize="xs"
                                    as="span"
                                    fontWeight="bold"
                                  >
                                    {results.context.matched} images found
                                  </Text>
                                )
                              )
                            )}
                          </Flex>
                        </Card.Content>
                      </Card>
                      {pipe(
                        searchResultsOption,
                        fold(
                          () => null,
                          (results) =>
                            results?.features?.length && (
                              <div className={styles.resultsScrollContainer}>
                                <Stack
                                  direction="column"
                                  minHeight="min-content"
                                >
                                  {results.features.map((result, key) => (
                                    <SearchResultItem
                                      result={result}
                                      key={key}
                                    />
                                  ))}
                                </Stack>
                              </div>
                            )
                        )
                      )}
                    </Flex>
                  </>
                )
              )
            )}
          </Flex>
        </div>
      )
    )
  );
}
