"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name");
    const email = formData.get("email");
    const message = formData.get("message");
    
    // Simple mailto fallback
    const mailtoLink = `mailto:[EMAIL]?subject=Contact van ${name}&body=${encodeURIComponent(
      `Naam: ${name}\nE-mail: ${email}\n\nBericht:\n${message}`
    )}`;
    
    window.location.href = mailtoLink;
    setSubmitted(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">Contact</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-4">Contact</h1>
      <p className="text-gray-600 mb-8">
        Heb je een vraag of opmerking? Stuur ons een bericht.
      </p>

      {submitted ? (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
          <p className="font-medium">Bedankt voor je bericht!</p>
          <p className="text-sm mt-1">We nemen zo snel mogelijk contact met je op.</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6 mb-8">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
            Naam *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="Je naam"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
            E-mailadres *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="je@email.be"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-900 mb-2">
            Bericht *
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={6}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
            placeholder="Je bericht..."
          />
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white font-medium px-6 py-3 rounded-lg transition"
        >
          Verstuur
        </button>
      </form>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Andere contactmogelijkheden</h2>
          <p className="text-gray-600 leading-relaxed">
            Je kan ons ook bereiken via{" "}
            <a href="mailto:[EMAIL]" className="text-blue-700 hover:underline">
              [EMAIL]
            </a>
            .
          </p>
          <p className="text-gray-600 leading-relaxed mt-3">
            Of bezoek onze{" "}
            <a
              href="https://www.facebook.com/groups/superpromobelgie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              Facebook-groep
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
