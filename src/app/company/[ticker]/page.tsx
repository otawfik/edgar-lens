import type { Metadata } from "next";
import { RewindView } from "@/components/company/RewindView";
import { getDataset } from "@/server/dataset";

type Props = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const fin = getDataset().company(decodeURIComponent(ticker));
  return {
    title: fin ? `${fin.company.ticker} · ${fin.company.name}` : "Unknown company",
    description: fin
      ? `Rewind ${fin.company.name}'s reported financials to any filing date and see which figures were later changed.`
      : undefined,
  };
}

export default async function CompanyPage({ params }: Props) {
  const { ticker } = await params;
  return <RewindView ticker={decodeURIComponent(ticker).toUpperCase()} />;
}
