export const services = [
  { slug: "bespoke-rugs", category: "rugs", image: "rug-composition" },
  { slug: "bespoke-mirrors", category: "mirrors", image: "mirror-wave" },
  { slug: "wall-art", category: "wall", image: "maison-interior" },
] as const;
export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}
