import { ReactNode } from "react";
import { Box, Divider, BoxProps } from "@chakra-ui/core";

type Props = BoxProps & {
  children: ReactNode;
};

export default function Card({ children, ...rest }: Props) {
  return (
    <Box bg="gray.50" rounded="lg" {...rest}>
      {children}
    </Box>
  );
}

function Content({ children, ...rest }: Props) {
  return (
    <Box padding={4} {...rest} rounded="lg">
      {children}
    </Box>
  );
}

Card.Content = Content;

Card.Divider = () => <Divider borderColor="#dadada" m={0} p={0} />;
