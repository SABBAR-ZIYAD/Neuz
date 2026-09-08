export const products = [
  { id: "arch", image: "maison-interior", category: "wall", creation: "wall" },
  { id: "wave", image: "mirror-wave", category: "mirrors", creation: "mirror" },
  { id: "rug", image: "rug-composition", category: "rugs", creation: "rug" },
  {
    id: "mirror",
    image: "mirror-arch",
    category: "mirrors",
    creation: "mirror",
  },
  { id: "color", image: "rug-sculptural", category: "rugs", creation: "rug" },
  {
    id: "babouche",
    image: "mirror-babouche",
    category: "mirrors",
    creation: "mirror",
  },
] as const;
export type Product = (typeof products)[number];
export const contact = {
  email: "neuzinteriordesign@gmail.com",
  phone: "+212700388324",
  whatsapp: "https://wa.me/212700388324",
  instagram: "https://www.instagram.com/neuz.ma/",
};
