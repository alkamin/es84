import styles from "../styles/Home.module.css";
import {
  Button,
  Card,
  Row,
  Text,
  Image,
  Input,
  useClipboard,
  useToasts,
  Spacer,
  Tag,
} from "@geist-ui/react";
import { Clipboard, Cloud } from "@geist-ui/react-icons";

import { format } from "date-fns";
import { useState, useRef, useEffect } from "react";
import { useHoverDirty, useHover, useRafState } from "react-use";

type Props = {
  result: any;
  onHover: (result: any) => void;
  onLeave: (result: any) => void;
};

const getVsiPath = (url: string) => {
  if (url.startsWith("s3")) {
    return url.replace("s3://", "/vsis3/");
  } else {
    const s1 = url.replace("http://", "").replace("https://", "");
    const s2 = s1.slice(0, s1.indexOf("."));
    const s3 = s1.slice(s1.indexOf("/"));
    return `/vsis3/${s2}${s3}`;
  }
};

const generateCommand = (name, result) => {
  return `AWS_DEFAULT_PROFILE=raster-foundry gdal_merge.py -co COMPRESS=DEFLATE -co PREDICTOR=2 -separate -o ${name
    .toLowerCase()
    .replaceAll(" ", "_")}.tif '${getVsiPath(
    result.assets.B04.href
  )}' '${getVsiPath(result.assets.B03.href)}' '${getVsiPath(
    result.assets.B02.href
  )}'`;
};

export default function SearchResultItem({ result, onHover, onLeave }: Props) {
  const [, setToast] = useToasts();
  const { copy } = useClipboard();
  const [fileName, setFileName] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    console.log(isHovered);
    isHovered ? onHover(result) : onLeave(result);
  }, [isHovered]);

  const onSubmitCommand = (e: React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    copy(generateCommand(fileName, result));
    setToast({
      text: "GDAL command copied!",
    });
    return false;
  };

  return (
    <Card
      style={{ marginBottom: "8px" }}
      onMouseEnter={() => !isHovered && setIsHovered(true)}
      onMouseLeave={() => isHovered && setIsHovered(false)}
    >
      <Card.Content>
        <Row style={{ marginTop: "-8px" }} justify="start" align="middle">
          <Text size={12} b>
            {format(new Date(result.properties.datetime), "PPP")}
          </Text>
          <Spacer x={1} />
          <Text size={12} span>
            {result.properties["eo:cloud_cover"]}%
          </Text>
        </Row>
        <Row style={{ marginBottom: "8px" }} justify="start" align="middle">
          <Text size={12} span>
            {result.collection}
          </Text>
        </Row>
        <Image
          className={styles.thumbnail}
          width={343}
          height={343}
          src={result.assets.thumbnail.href}
        />
      </Card.Content>
      <Card.Footer>
        <form onSubmit={onSubmitCommand} style={{ width: "100%" }}>
          <div style={{ display: "flex", width: "100%" }}>
            <Input
              name="name"
              placeholder="Output file name"
              value={fileName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFileName(e.target.value)
              }
              width="100%"
            />
          </div>
        </form>
      </Card.Footer>
    </Card>
  );
}
