'use client';

import { Crown, Shield, Wand2, Users } from 'lucide-react';

export default function StaffPage() {
  const staffMembers = [
    {
      id: 1,
      name: 'Administrador',
      role: 'Fundador & Administrador',
      description: 'Responsable del servidor y sus sistemas principales',
      icon: Crown,
      color: 'from-amber-500 to-amber-600'
    },
    {
      id: 2,
      name: 'GameMaster',
      role: 'Game Master',
      description: 'Encargado de eventos y moderación del servidor',
      icon: Wand2,
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 3,
      name: 'Moderador',
      role: 'Moderador',
      description: 'Mantiene el orden en la comunidad y resuelve conflictos',
      icon: Shield,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 4,
      name: 'Reporte de Errores',
      role: 'Tech Support',
      description: 'Asiste con problemas técnicos y configuración',
      icon: Users,
      color: 'from-green-500 to-green-600'
    },
  ];

  return (
    <main 
      className="min-h-screen pt-32 pb-20 text-white selection:bg-purple-600/30 font-sans relative overflow-x-hidden"
      style={{
        backgroundImage: "url('/fono.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="flex flex-col items-center gap-3 mb-8">
            <Crown className="w-16 h-16 text-purple-500 animate-pulse bg-purple-950/20 p-4 rounded-full border border-purple-900/40" />
            <h1 className="text-6xl md:text-7xl font-black italic tracking-tighter text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] uppercase">
              Nuestro Staff
            </h1>
          </div>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed font-light">
            Conoce al equipo dedicado que hace posible la experiencia en Shadow Azeroth. Estos son los héroes detrás del servidor.
          </p>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 mb-20">
          {staffMembers.map((member) => {
            const IconComponent = member.icon;
            return (
              <div
                key={member.id}
                className="group relative"
              >
                {/* Glow effect */}
                <div className={`absolute inset-0 bg-gradient-to-r ${member.color} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300 rounded-lg`} />
                
                {/* Card */}
                <div className="relative p-8 bg-black/60 border-2 border-purple-900/30 rounded-lg backdrop-blur-md hover:border-purple-600/50 transition-all duration-300 overflow-hidden group-hover:scale-105">
                  {/* Top border accent */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${member.color}`} />
                  
                  {/* Icon */}
                  <div className="flex justify-center mb-6">
                    <div className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${member.color} p-0.5`}>
                      <div className="w-full h-full rounded-full bg-black/80 flex items-center justify-center">
                        <IconComponent className="w-10 h-10 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Name */}
                  <h2 className="text-3xl font-black text-center text-white mb-2 uppercase tracking-tight">
                    {member.name}
                  </h2>

                  {/* Role */}
                  <div className="text-center mb-4 py-3 bg-purple-950/20 rounded-sm border border-purple-900/30">
                    <p className="text-sm font-bold uppercase tracking-widest text-purple-400">
                      {member.role}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-gray-300 text-center text-sm leading-relaxed italic">
                    {member.description}
                  </p>

                  {/* Hover effect line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${member.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Appreciation Section */}
        <div className="max-w-3xl mx-auto p-8 bg-gradient-to-r from-purple-950/20 to-blue-950/20 border border-purple-900/30 rounded-lg backdrop-blur-md text-center">
          <p className="text-lg text-gray-300 leading-relaxed mb-4">
            <span className="font-bold text-purple-400">Agradecemos profundamente</span> a cada miembro del staff por su dedicación y esfuerzo en mantener Shadow Azeroth como un lugar acogedor y seguro para la comunidad.
          </p>
          <p className="text-sm text-gray-500 italic">
            🎖️ Sin ustedes, esto no sería posible. ¡Gracias por ser los guardianes de nuestro reino!
          </p>
        </div>
      </div>
    </main>
  );
}
