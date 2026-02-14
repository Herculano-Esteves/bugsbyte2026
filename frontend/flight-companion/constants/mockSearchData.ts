export interface Article {
    id: number;
    tags: string[];
    hiddenTags: string[];
    title: string;
    text: string;
    image: string;
}

export const mockArticles: Article[] = [
    {
        id: 1,
        tags: ['safety', 'emergency'],
        hiddenTags: ['procedure', 'evacuation', 'mask'],
        title: 'In-Flight Safety Guide',
        text: 'Learn about the safety procedures and emergency protocols for your flight. Always pay attention to the flight attendants during the safety briefing.',
        image: 'https://images.unsplash.com/photo-1542296332-2e44a99cfef0?q=80&w=2666&auto=format&fit=crop',
    },
    {
        id: 2,
        tags: ['tips', 'comfort'],
        hiddenTags: ['sleep', 'jetlag', 'health'],
        title: 'Avoiding Jet Lag',
        text: 'Tips and tricks to stay fresh during long haul flights. Drink plenty of water and try to adjust your sleep schedule before you fly.',
        image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2674&auto=format&fit=crop',
    },
    {
        id: 3,
        tags: ['food', 'dining'],
        hiddenTags: ['menu', 'drinks', 'snacks'],
        title: 'In-Flight Dining Experience',
        text: 'Discover our gourmet meal options and beverage selection. We offer a variety of meals to cater to different dietary requirements.',
        image: 'https://images.unsplash.com/photo-1542296332-2e44a99cfef0?q=80&w=2666&auto=format&fit=crop', // Reusing image for now as placeholder
    },
    {
        id: 4,
        tags: ['entertainment', 'movies'],
        hiddenTags: ['wifi', 'music', 'games'],
        title: 'Entertainment System',
        text: 'Explore our vast library of movies, music, and games available on your personal screen. Wi-Fi is also available on select flights.',
        image: 'https://images.unsplash.com/photo-1517400508447-f8dd518b86db?q=80&w=2670&auto=format&fit=crop',
    },
    {
        id: 5,
        tags: ['destination', 'travel'],
        hiddenTags: ['paris', 'france', 'europe'],
        title: 'Destination Guide: Paris',
        text: 'Top attractions and hidden gems in the City of Light. Visit the Eiffel Tower, the Louvre, and enjoy authentic French pastries.',
        image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2673&auto=format&fit=crop',
    },
];
