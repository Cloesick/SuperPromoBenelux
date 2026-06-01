import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Pagina niet gevonden</h1>
        <p className="text-gray-600 mb-8">
          De pagina die je zoekt bestaat niet of werd verplaatst.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-blue-700 hover:bg-blue-800 text-white font-medium px-5 py-2.5 rounded-lg transition"
          >
            Terug naar de homepagina
          </Link>
          <Link
            href="/folders"
            className="inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-5 py-2.5 rounded-lg transition"
          >
            Bekijk folders
          </Link>
        </div>
      </div>
    </div>
  );
}
