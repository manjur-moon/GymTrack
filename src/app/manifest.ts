import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name:"GymTrack — Workout Tracker", short_name:"GymTrack", start_url:"/", display:"standalone", background_color:"#090f19", theme_color:"#090f19", icons:[{src:"/icons/icon-192.png",sizes:"192x192",type:"image/png"},{src:"/icons/icon-512.png",sizes:"512x512",type:"image/png"}] }; }
