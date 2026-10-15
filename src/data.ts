export type Category = 'Gastronomie' | 'Culture & loisirs' | 'Communauté' | 'Commerce' | 'Stationnement' | 'Municipal';
export type Interest = 'Gastronomie' | 'Arts & culture' | 'Musique' | 'Sports & bien-être' | 'Bénévolat' | 'Activités étudiantes' | 'Événements gratuits' | 'Découverte locale';
export type EventItem = { id:string; title:string; description:string; date:string; time:string; place:string; category:Category; price:string; organizer:string; lat:number; lng:number; free?:boolean; community?:boolean };
export type Place = { id:string; name:string; description:string; category:Category; address:string; lat:number; lng:number; tag:string };
export type Update = { id:string; title:string; description:string; type:'Travaux'|'Projet'|'Annonce'; date:string; status:'Publié'|'Planifié'; lat:number; lng:number };
export type CleanlinessReport = { id:string; category:'Graffiti'|'Saleté'|'Dépôt sauvage'|'Autre'; description:string; address:string; latitude:number; longitude:number; photo?:string; createdAt:string; status:'Nouveau'|'Pris en charge' };

export const places: Place[] = [
 {id:'p1',name:'Le Knock-Out',description:'Café de quartier, brunch et soirées musicales.',category:'Gastronomie',address:'832, rue Saint-Joseph Est',lat:46.8168,lng:-71.2204,tag:'Café & resto'},
 {id:'p2',name:'La Maison de la littérature',description:'Un lieu vivant pour lire, écrire et partager.',category:'Culture & loisirs',address:'40, rue Saint-Stanislas',lat:46.8149,lng:-71.2108,tag:'Culture'},
 {id:'p3',name:'Lauberivière',description:'Un organisme qui agit pour une communauté plus solidaire.',category:'Communauté',address:'401, rue Saint-Paul',lat:46.8171,lng:-71.2158,tag:'Organisme'},
 {id:'p4',name:'Le Grand Marché de Québec',description:'Producteurs locaux, découvertes gourmandes et événements.',category:'Commerce',address:'250, boulevard Wilfrid-Hamel',lat:46.8157,lng:-71.2263,tag:'Marché'}
];
places.push(
 {id:'parking-1',name:'Stationnement du Grand Marché',description:'Stationnement de proximité pour visiter le marché et les commerces voisins.',category:'Stationnement',address:'250, boulevard Wilfrid-Hamel',lat:46.8153,lng:-71.2268,tag:'Stationnement · Démo'},
 {id:'parking-2',name:'Stationnement Saint-Roch Est',description:'Option de stationnement à proximité de la rue Saint-Joseph et des événements.',category:'Stationnement',address:'560, rue Saint-Joseph Est',lat:46.8171,lng:-71.2172,tag:'Stationnement · Démo'},
 {id:'parking-3',name:'Stationnement du secteur culturel',description:'Stationnement pratique pour la Maison de la littérature et les lieux culturels.',category:'Stationnement',address:'90, rue Saint-Stanislas',lat:46.8152,lng:-71.2113,tag:'Stationnement · Démo'}
);
export const initialEvents: EventItem[] = [
 {id:'e1',title:'Marché créatif de Saint-Roch',description:'Une journée pour rencontrer les artisans et créateurs du quartier.',date:'2026-10-24',time:'10 h – 16 h',place:'Le Grand Marché de Québec',category:'Commerce',price:'Gratuit',organizer:'Saint-Roch Connect',lat:46.8157,lng:-71.2263,free:true},
 {id:'e2',title:'Soirée jazz au Knock-Out',description:'Un moment chaleureux avec des musiciennes et musiciens d’ici.',date:'2026-10-27',time:'19 h 30',place:'Le Knock-Out',category:'Culture & loisirs',price:'15 $',organizer:'Le Knock-Out',lat:46.8168,lng:-71.2204},
 {id:'e3',title:'Café-rencontre des voisins',description:'Venez faire connaissance et partager vos idées pour le quartier.',date:'2026-11-02',time:'18 h',place:'La Maison de la littérature',category:'Communauté',price:'Gratuit',organizer:'Collectif Saint-Roch',lat:46.8149,lng:-71.2108,free:true,community:true}
];
export const initialUpdates: Update[] = [
 {id:'u1',title:'Info-démo : verdissement de la rue Saint-Joseph',description:'Exemple de publication municipale pour illustrer le prototype.',type:'Projet',date:'Jusqu’au 15 novembre',status:'Planifié',lat:46.8162,lng:-71.2180},
 {id:'u2',title:'Avis démo : travaux de mobilité',description:'Données fictives — consulter les sources officielles avant toute décision.',type:'Travaux',date:'Du 4 au 8 novembre',status:'Publié',lat:46.8180,lng:-71.2140}
];
export const interests: Interest[] = ['Gastronomie','Arts & culture','Musique','Sports & bien-être','Bénévolat','Activités étudiantes','Événements gratuits','Découverte locale'];
