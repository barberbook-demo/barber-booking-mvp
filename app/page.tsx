export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">BarberBook</h1>
      <p className="mt-3 text-xl font-medium">Online Booking</p>
      <p className="mt-4 text-base text-gray-600">
        Κλείσε εύκολα το επόμενο ραντεβού σου.
      </p>
      <button
        type="button"
        className="mt-8 rounded-md bg-black px-6 py-3 text-sm font-semibold text-white"
      >
        Κλείσε ραντεβού
      </button>
    </main>
  );
}
