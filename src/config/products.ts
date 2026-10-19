export interface ProductConfig {
  id: string;
  name: string;
  tagline: string;
  /** Tech Community Khoros board ids (RSS: /t5/s/gxcuf89792/rss/board?board.id=<id>). Ids can differ from URL slugs. */
  techCommunityBoards: string[];
  /** Public Tech Community URL for the product's forum. */
  techCommunityUrl: string;
  /** Subreddit names without the "r/" prefix. Missing subreddits are skipped at ingest time. */
  subreddits: string[];
  /** Appended to Microsoft Learn searches so results stay product-relevant. */
  learnHint: string;
}

export const PRODUCTS: ProductConfig[] = [
  {
    id: "foundry",
    name: "Microsoft Foundry",
    tagline: "Build, evaluate and deploy AI apps and agents",
    techCommunityBoards: ["azure-ai-foundry-discussions"],
    techCommunityUrl: "https://techcommunity.microsoft.com/category/azure-ai-foundry",
    subreddits: ["AzureFoundry"],
    learnHint: "Microsoft Foundry",
  },
  {
    id: "copilot-studio",
    name: "Copilot Studio",
    tagline: "Low-code agents and copilots",
    techCommunityBoards: ["copilot-studio"],
    techCommunityUrl:
      "https://techcommunity.microsoft.com/category/microsoft-copilot/discussions/copilot-studio",
    subreddits: ["CopilotStudio"],
    learnHint: "Microsoft Copilot Studio",
  },
  {
    id: "microsoft-copilot",
    name: "Microsoft Copilot",
    tagline: "Copilot across Windows, Edge and Microsoft 365",
    techCommunityBoards: ["microsoft-copilot"],
    techCommunityUrl:
      "https://techcommunity.microsoft.com/category/microsoft-copilot/discussions/microsoft-copilot",
    subreddits: ["microsoft_365_copilot", "copilotmicrosoft"],
    learnHint: "Microsoft 365 Copilot",
  },
  {
    id: "driving-adoption",
    name: "Driving Adoption",
    tagline: "Change management and adoption of Microsoft 365 and Copilot",
    techCommunityBoards: ["DrivingAdoption"],
    techCommunityUrl: "https://techcommunity.microsoft.com/category/drivingadoption",
    subreddits: [],
    learnHint: "Microsoft 365 adoption",
  },
];

export function getProduct(id: string): ProductConfig | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
