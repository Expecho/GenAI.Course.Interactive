"use client";

import { useEffect, useState } from "react";
import { topics } from "@/workshop/topics";
import { TopicSidebar } from "@/components/TopicSidebar";
import { CodeRunner } from "@/components/CodeRunner";
import { useProgress } from "@/components/useProgress";

export default function Home() {
  const { ready, lastTopicId, completed, setLast, markComplete, reset } = useProgress();
  const [activeId, setActiveId] = useState(topics[0].id);

  // Once stored progress has loaded, resume the last topic (if it still exists).
  useEffect(() => {
    if (ready && lastTopicId && topics.some((t) => t.id === lastTopicId)) {
      setActiveId(lastTopicId);
    }
  }, [ready, lastTopicId]);

  function select(id: string) {
    setActiveId(id);
    setLast(id);
  }

  const topic = topics.find((t) => t.id === activeId) ?? topics[0];
  const completedSet = new Set(completed);

  return (
    <main className="flex min-h-screen w-full">
      <TopicSidebar
        topics={topics}
        activeId={activeId}
        completed={completedSet}
        onSelect={select}
        onReset={reset}
      />
      <section className="min-w-0 flex-1">
        <CodeRunner key={topic.id} topic={topic} onComplete={() => markComplete(topic.id)} />
      </section>
    </main>
  );
}
