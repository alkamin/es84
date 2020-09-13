import "../styles/globals.css";
import { GeistProvider, CssBaseline } from "@geist-ui/react";

function MyApp({ Component, pageProps }) {
  return (
    <GeistProvider
      theme={{
        layout: {
          gapQuarter: "0pt",
          gapQuarterNegative: "0pt",
        },
      }}
    >
      <CssBaseline />
      <Component {...pageProps} />
    </GeistProvider>
  );
}

export default MyApp;
