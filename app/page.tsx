import AgentCustomizer from "@/components/AgentCustomizer";

export default function Page() {
  return (
    <main className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">EtherFi Strategy Arena</h1>
      <p className="text-gray-600">
        Customize your agents, choose decision mode (Math vs Claude), and run a simulated
        competition to discover the most profitable staking strategies.
      </p>
      <AgentCustomizer />
    </main>
  );
}
