'use client';

export function About() {
  return (
    <section className="py-24 bg-gray-800">
      <div className="container-max section-padding">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="fade-in">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Crafting Style Since 2014
            </h2>
            <p className="text-lg text-gray-300 mb-6 leading-relaxed">
              At DopeCuts, we believe every man deserves to look and feel his best. Our master barbers 
              combine traditional techniques with modern styles to deliver exceptional results every time.
            </p>
            <p className="text-lg text-gray-300 mb-8 leading-relaxed">
              From classic cuts to contemporary styles, we provide a premium grooming experience in a 
              comfortable, professional environment. Book your appointment today and discover the 
              DopeCuts difference.
            </p>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-3xl font-bold text-white mb-2">10+</div>
                <div className="text-gray-300">Years Experience</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-2">5000+</div>
                <div className="text-gray-300">Satisfied Clients</div>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="aspect-square bg-gray-700 rounded-lg overflow-hidden">
              <img
                src="https://images.pexels.com/photos/1319460/pexels-photo-1319460.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Master barber at work"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 bg-white text-black p-6 rounded-lg">
              <div className="text-2xl font-bold">4.9★</div>
              <div className="text-sm">Customer Rating</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}