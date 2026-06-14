export const CITIES = {
  delhi: { id: 'delhi', name: 'New Delhi', position: [-1.5, 6, 0], isHub: true },
  mumbai: { id: 'mumbai', name: 'Mumbai', position: [-4, -2, 0], isHub: true },
  ahmedabad: { id: 'ahmedabad', name: 'Ahmedabad', position: [-4.5, 1.5, 0] },
  jaipur: { id: 'jaipur', name: 'Jaipur', position: [-2.5, 4, 0] },
  lucknow: { id: 'lucknow', name: 'Lucknow', position: [1, 5, 0] },
  kanpur: { id: 'kanpur', name: 'Kanpur', position: [0.5, 4.5, 0] },
  patna: { id: 'patna', name: 'Patna', position: [3.5, 4, 0] },
  kolkata: { id: 'kolkata', name: 'Kolkata', position: [6, 1, 0], isHub: true },
  bhubaneswar: { id: 'bhubaneswar', name: 'Bhubaneswar', position: [4, -1.5, 0] },
  hyderabad: { id: 'hyderabad', name: 'Hyderabad', position: [0.5, -4, 0], isHub: true },
  bengaluru: { id: 'bengaluru', name: 'Bengaluru', position: [-0.5, -7, 0], isHub: true },
  chennai: { id: 'chennai', name: 'Chennai', position: [1.5, -6.5, 0], isHub: true },
  nagpur: { id: 'nagpur', name: 'Nagpur', position: [0, 0, 0] },
  pune: { id: 'pune', name: 'Pune', position: [-3.5, -3, 0] },
  surat: { id: 'surat', name: 'Surat', position: [-4, -0.5, 0] },
  bhopal: { id: 'bhopal', name: 'Bhopal', position: [-1, 1.5, 0] }
};

// Define major rail routes (splines) connecting cities
export const ROUTES = [
  // Golden Quadrilateral roughly
  ['delhi', 'jaipur'],
  ['jaipur', 'ahmedabad'],
  ['ahmedabad', 'surat'],
  ['surat', 'mumbai'],
  ['mumbai', 'pune'],
  ['pune', 'bengaluru'],
  ['bengaluru', 'chennai'],
  ['chennai', 'hyderabad'],
  ['hyderabad', 'nagpur'],
  ['nagpur', 'bhopal'],
  ['bhopal', 'kanpur'],
  ['kanpur', 'lucknow'],
  ['lucknow', 'delhi'],
  
  // East-West & Diagonals
  ['mumbai', 'nagpur'],
  ['nagpur', 'kolkata'],
  ['kolkata', 'bhubaneswar'],
  ['bhubaneswar', 'chennai'],
  
  // North-East
  ['delhi', 'kanpur'],
  ['kanpur', 'patna'],
  ['patna', 'kolkata'],
  
  // Cross country
  ['delhi', 'bhopal'],
  ['nagpur', 'hyderabad']
];
