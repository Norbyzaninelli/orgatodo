import type { MetadataRoute } from "next";

/** Permite instalar ORGATODO como app desde el celular o la computadora. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ORGATODO",
    short_name: "ORGATODO",
    description: "Turnos, recordatorios y facturación para profesionales en un solo lugar.",
    lang: "es-AR",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#0b1633",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
