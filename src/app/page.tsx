"use client";

import { useEffect, useState } from "react";
import { topics } from "@/workshop/topics";
import { TopicSidebar } from "@/components/TopicSidebar";
import { CodeRunner } from "@/components/CodeRunner";
import { useProgress } from "@/components/useProgress";
import { FeedbackWidget } from "@/components/FeedbackWidget";

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
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  const index = topics.findIndex((t) => t.id === activeId);
  const topic = topics[index] ?? topics[0];
  const prev = index > 0 ? topics[index - 1] : undefined;
  const next = index >= 0 && index < topics.length - 1 ? topics[index + 1] : undefined;
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
        <CodeRunner
          key={topic.id}
          topic={topic}
          onComplete={() => markComplete(topic.id)}
          prev={prev}
          next={next}
          onNavigate={select}
        />
      </section>
      <FeedbackWidget topicId={topic.id} topicTitle={topic.title} />
    </main>
  );
}
