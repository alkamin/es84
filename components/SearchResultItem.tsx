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
import { BsClipboard, BsStarFill } from "react-icons/bs";
import { generateCommand } from "../lib/generateCommand";

type Props = {
  result: any;
  isSaved: boolean;
  onSave: (command: string, result: any) => void;
};

export default function SearchResultItem({ result, onSave, isSaved }: Props) {
  const toast = useToast();
  const [, copy] = useCopyToClipboard();
  const [fileName, setFileName] = useState("");

  const onClickCopyCommand = (e: React.FormEvent) => {
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

  const onSubmitCommand = (e: React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const file = fileName || "output";
    onSave(generateCommand(file, result), result);
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
              onClick={onClickCopyCommand}
              size="sm"
              mr={1}
            />
            <IconButton
              icon={<BsStarFill color={isSaved ? "orange" : "gray"} />}
              aria-label="Save command for later"
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
