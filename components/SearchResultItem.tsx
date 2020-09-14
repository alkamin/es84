import styles from "../styles/Home.module.css";
import Card from "../components/Card";

import { format } from "date-fns";
import { useState } from "react";
import { useCopyToClipboard } from "react-use";
import {
  AspectRatio,
  Box,
  Flex,
  Text,
  Image,
  Input,
  useToast,
  Button,
  IconButton,
} from "@chakra-ui/core";
import { BsClipboard } from "react-icons/bs";

type Props = {
  result: any;
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

export default function SearchResultItem({ result }: Props) {
  const toast = useToast();
  const [, copy] = useCopyToClipboard();
  const [fileName, setFileName] = useState("");

  const onSubmitCommand = (e: React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const file = fileName || "output";
    copy(generateCommand(file, result));
    toast({
      title: fileName,
      description: "GDAL command copied !",
    });
    return false;
  };

  return (
    <Card>
      <Card.Content>
        <Box mb={3}>
          <Flex>
            <Text fontSize="xs" as="span" fontWeight="bold">
              {format(new Date(result.properties.datetime), "PPP")}
            </Text>
            <Text fontSize="xs" as="span" ml={2}>
              {result.properties["eo:cloud_cover"]}%
            </Text>
          </Flex>
          <Box>
            <Text fontSize="xs" as="span">
              {result.collection}
            </Text>
          </Box>
        </Box>
        <AspectRatio maxW="100%" ratio={1} bg="gray.200">
          <Image
            border="1px solid #dadada"
            width="100%"
            src={result.assets.thumbnail.href}
          />
        </AspectRatio>
      </Card.Content>
      <Card.Divider />
      <Card.Content>
        <form onSubmit={onSubmitCommand} style={{ width: "100%" }}>
          <Flex>
            <Input
              name="name"
              placeholder="Output file name"
              value={fileName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFileName(e.target.value)
              }
              width="100%"
              size="sm"
              mr={2}
            />
            <IconButton
              icon={<BsClipboard />}
              aria-label="Copy command to clipboard"
              variant="outline"
              type="submit"
              size="sm"
            />
          </Flex>
        </form>
      </Card.Content>
    </Card>
  );
}
