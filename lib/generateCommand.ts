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

export const generateCommand = (name, result) => {
  return `AWS_DEFAULT_PROFILE=raster-foundry gdal_merge.py -co COMPRESS=DEFLATE -co PREDICTOR=2 -separate -o ${name
    .toLowerCase()
    .replaceAll(" ", "_")}.tif '${getVsiPath(
    result.assets.B04.href
  )}' '${getVsiPath(result.assets.B03.href)}' '${getVsiPath(
    result.assets.B02.href
  )}'`;
};
