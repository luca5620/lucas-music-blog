/**
 * FAQSchema — Reusable JSON-LD structured data component for FAQ pages.
 *
 * Outputs a <script type="application/ld+json"> tag with FAQPage schema
 * that Google uses to display rich FAQ snippets in search results.
 *
 * Usage:
 *   <FAQSchema items={[{ question: "...", answer: "..." }]} />
 */

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  items: FAQItem[];
}

export default function FAQSchema({ items }: FAQSchemaProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // Escape < > & so content can never break out of the script tag (XSS).
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData)
          .replace(/</g, "\\u003c")
          .replace(/>/g, "\\u003e")
          .replace(/&/g, "\\u0026"),
      }}
    />
  );
}
