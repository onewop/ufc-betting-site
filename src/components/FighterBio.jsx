import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const FighterBio = () => {
  const { id } = useParams();
  const [fighter, setFighter] = useState(null);
  const [loading, setLoading] = useState(true);

  const enhancedInfos = {
    1: {
      bio: "John Yannis bio not available. Upcoming fighter in UFC Fight Night Aug 2.",
      links: [],
      full_fight_history: [],
      additional_stats: {},
    },
    2: {
      bio: "Austin Bashi is a 23-year-old fighter from West Bloomfield Township, Michigan, United States. Pro debut in 2020, UFC debut January 11, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Austin-Bashi-362871",
        },
        {
          name: "UFC Stats",
          url: "http://ufcstats.com/fighter-details/d3f89fa685bd8420",
        },
      ],
      full_fight_history: [
        {
          opponent: "Christian Rodriguez",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "1/11/2025",
        },
        {
          opponent: "Dorian Ramos",
          result: "Win",
          method: "Submission (Rear-Naked Choke)",
          round: 2,
          time: "3:15",
          date: "9/3/2024",
        },
        {
          opponent: "Zac Riley",
          result: "Win",
          method: "TKO (Punches)",
          round: 1,
          time: "3:48",
          date: "6/1/2024",
        },
      ],
      additional_stats: {
        ko_wins: 3,
        submission_wins: 5,
        first_round_finishes: 4,
      },
    },
    3: {
      bio: "Felipe Bunes is a fighter from Brazil. Limited info available.",
      links: [],
      full_fight_history: [],
      additional_stats: {},
    },
    4: {
      bio: "Rafael Estevam, nicknamed Macapa, is a 28-year-old fighter from Macapa, Amapa, Brazil. Pro debut in 2015.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rafael-Estevam-200851",
        },
      ],
      full_fight_history: [
        {
          opponent: "Jesus Santos Aguilar",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "2/15/2025",
        },
        {
          opponent: "Charles Johnson",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "11/18/2023",
        },
        {
          opponent: "Joao Elias",
          result: "Win",
          method: "TKO (Punches)",
          round: 2,
          time: "2:25",
          date: "9/27/2022",
        },
      ],
      additional_stats: {
        ko_wins: 4,
        submission_wins: 3,
        first_round_finishes: 1,
      },
    },
    5: {
      bio: "Kevin Vallejos, nicknamed El Chino, is a 23-year-old fighter from Mar del Plata, Buenos Aires, Argentina. Pro debut in 2021, UFC debut March 15, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Kevin-Vallejos-391233",
        },
      ],
      full_fight_history: [
        {
          opponent: "Seung Woo Choi",
          result: "Win",
          method: "TKO (Punches)",
          round: 1,
          time: "3:09",
          date: "3/15/2025",
        },
        {
          opponent: "Cam Teague",
          result: "Win",
          method: "TKO (Punches)",
          round: 1,
          time: "2:23",
          date: "9/24/2024",
        },
        {
          opponent: "Gonzalo Contreras",
          result: "Win",
          method: "KO (Punch)",
          round: 2,
          time: "4:23",
          date: "3/2/2024",
        },
      ],
      additional_stats: {
        ko_wins: 11,
        submission_wins: 2,
        first_round_finishes: 6,
      },
    },
    6: {
      bio: "Danny Silva, nicknamed Puma, is a 28-year-old fighter from Santa Ana, California, United States. Fighting style: Boxing. Pro debut in 2019, UFC debut September 26, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Danny-Silva-310429",
        },
      ],
      full_fight_history: [
        {
          opponent: "Lucas Almeida",
          result: "Win",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "3/1/2025",
        },
        {
          opponent: "Joshua Culibao",
          result: "Win",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "3/16/2024",
        },
        {
          opponent: "Angel Pacheco",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "9/26/2023",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 0,
        first_round_finishes: 3,
      },
    },
    7: {
      bio: "Nathan Fletcher is a 27-year-old fighter from Liverpool, England. Pro debut in 2019, UFC debut March 22, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Nathan-Fletcher-275293",
        },
      ],
      full_fight_history: [
        {
          opponent: "Caolan Loughran",
          result: "Loss",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "3/22/2025",
        },
        {
          opponent: "Zygimantas Ramaska",
          result: "Win",
          method: "Submission (Arm-Triangle Choke)",
          round: 2,
          time: "1:14",
          date: "9/7/2024",
        },
        {
          opponent: "Daan Duijs",
          result: "Win",
          method: "Submission (Triangle Choke)",
          round: 1,
          time: "4:15",
          date: "4/15/2023",
        },
      ],
      additional_stats: {
        ko_wins: 1,
        submission_wins: 7,
        first_round_finishes: 4,
      },
    },
    8: {
      bio: "Rinya Nakamura, nicknamed Hybrid, is a 30-year-old fighter from Saitama, Japan. Pro debut not specified, UFC debut February 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rinya-Nakamura-386855",
        },
      ],
      full_fight_history: [
        {
          opponent: "Muin Gafurov",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "1/18/2025",
        },
        {
          opponent: "Carlos Vera",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "2/17/2024",
        },
        {
          opponent: "Fernie Garcia",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "8/26/2023",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 1,
        first_round_finishes: 5,
      },
    },
    9: {
      bio: "HyunSung Park, nicknamed Peace of Mind, is a 29-year-old fighter from Gyeonggi, South Korea. Pro debut 2018, UFC debut February 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Hyun-Sung-Park-289999",
        },
      ],
      full_fight_history: [
        {
          opponent: "Carlos Hernandez",
          result: "Win",
          method: "Submission (Rear-Naked Choke)",
          round: 1,
          time: "2:26",
          date: "5/17/2025",
        },
        {
          opponent: "Shannon Ross",
          result: "Win",
          method: "TKO (Knee and Punches)",
          round: 2,
          time: "3:59",
          date: "12/9/2023",
        },
        {
          opponent: "Seung Guk Choi",
          result: "Win",
          method: "Submission (Rear-Naked Choke)",
          round: 3,
          time: "3:11",
          date: "2/4/2023",
        },
      ],
      additional_stats: {
        ko_wins: 4,
        submission_wins: 5,
        first_round_finishes: 4,
      },
    },
    10: {
      bio: "Tatsuro Taira is a 25-year-old fighter from Naha, Okinawa, Japan. Pro debut in 2018, UFC debut 2022.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Tatsuro-Taira-293975",
        },
      ],
      full_fight_history: [
        {
          opponent: "Brandon Royval",
          result: "Loss",
          method: "Decision (Split)",
          round: 5,
          time: "5:00",
          date: "10/12/2024",
        },
        {
          opponent: "Alex Perez",
          result: "Win",
          method: "TKO (Knee Injury)",
          round: 2,
          time: "2:59",
          date: "6/15/2024",
        },
        {
          opponent: "Carlos Hernandez",
          result: "Win",
          method: "TKO (Punches)",
          round: 2,
          time: "0:55",
          date: "12/9/2023",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 7,
        first_round_finishes: 7,
      },
    },
    11: {
      bio: "Esteban Ribovics, nicknamed El Gringo, is a 29-year-old fighter from Tartagal, Salta, Argentina. Pro debut in 2015, UFC debut March 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Esteban-Ribovics-214867",
        },
      ],
      full_fight_history: [
        {
          opponent: "Nasrat Haqparast",
          result: "Loss",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "3/1/2025",
        },
        {
          opponent: "Daniel Zellhuber",
          result: "Win",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "9/14/2024",
        },
        {
          opponent: "Terrance McKinney",
          result: "Win",
          method: "KO (Head Kick)",
          round: 1,
          time: "0:37",
          date: "5/11/2024",
        },
      ],
      additional_stats: {
        ko_wins: 7,
        submission_wins: 5,
        first_round_finishes: 7,
      },
    },
    12: {
      bio: "Elves Brener is a 27-year-old fighter from Maues, Amazonas, Brazil. Pro debut in 2016, UFC debut February 11, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Elves-Brener-224229",
        },
      ],
      full_fight_history: [
        {
          opponent: "Joel Alvarez",
          result: "Loss",
          method: "TKO (Knees and Punches)",
          round: 3,
          time: "3:36",
          date: "8/3/2024",
        },
        {
          opponent: "Myktybek Orolbai",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "5/4/2024",
        },
        {
          opponent: "Kaynan Kruschewsky",
          result: "Win",
          method: "KO (Punch)",
          round: 1,
          time: "4:01",
          date: "11/4/2023",
        },
      ],
      additional_stats: {
        ko_wins: 3,
        submission_wins: 11,
        first_round_finishes: 9,
      },
    },
    13: {
      bio: "Chris Duncan, nicknamed The Problem, is a 32-year-old fighter from Alloa, East Ayrshire, Scotland. Pro debut in 2018, UFC debut March 18, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Chris-Duncan-74346",
        },
      ],
      full_fight_history: [
        {
          opponent: "Jordan Vucenic",
          result: "Win",
          method: "Submission (Guillotine Choke)",
          round: 2,
          time: "3:42",
          date: "3/22/2025",
        },
        {
          opponent: "Bolaji Oki",
          result: "Win",
          method: "Technical Submission (Guillotine Choke)",
          round: 1,
          time: "3:34",
          date: "9/28/2024",
        },
        {
          opponent: "Manuel Torres",
          result: "Loss",
          method: "Submission (Rear-Naked Choke)",
          round: 1,
          time: "1:46",
          date: "2/24/2024",
        },
      ],
      additional_stats: {
        ko_wins: 7,
        submission_wins: 3,
        first_round_finishes: 6,
      },
    },
    14: {
      bio: "Mateusz Rebecki, nicknamed Chinczyk, is a 32-year-old fighter from Szczecin, Poland. Pro debut in 2014, UFC debut 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Mateusz-Rebecki-146417",
        },
      ],
      full_fight_history: [
        {
          opponent: "Myktybek Orolbai",
          result: "Win",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "10/26/2024",
        },
        {
          opponent: "Diego Ferreira",
          result: "Loss",
          method: "TKO (Punches)",
          round: 3,
          time: "4:51",
          date: "5/11/2024",
        },
        {
          opponent: "Roosevelt Roberts",
          result: "Win",
          method: "Submission (Armbar)",
          round: 1,
          time: "3:08",
          date: "11/11/2023",
        },
      ],
      additional_stats: {
        ko_wins: 9,
        submission_wins: 7,
        first_round_finishes: 9,
      },
    },
    15: {
      bio: "Tresean Gore, nicknamed Mr. Vicious, is a 31-year-old fighter from Myrtle Beach, South Carolina, United States. Pro debut in 2018, UFC debut February 5, 2022.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Tresean-Gore-289719",
        },
      ],
      full_fight_history: [
        {
          opponent: "Marco Tulio",
          result: "Loss",
          method: "TKO (Punch)",
          round: 2,
          time: "3:16",
          date: "4/12/2025",
        },
        {
          opponent: "Antonio Trocoli",
          result: "Win",
          method: "Submission (Guillotine Choke)",
          round: 1,
          time: "1:23",
          date: "11/9/2024",
        },
        {
          opponent: "Josh Fremd",
          result: "Win",
          method: "Technical Submission (Guillotine Choke)",
          round: 2,
          time: "0:49",
          date: "10/29/2022",
        },
      ],
      additional_stats: {
        ko_wins: 1,
        submission_wins: 3,
        first_round_finishes: 3,
      },
    },
    16: {
      bio: "Rodolfo Vieira, nicknamed The Black Belt Hunter, is a 35-year-old fighter from Rio de Janeiro, Rio de Janeiro, Brazil. Pro debut not specified, UFC debut not specified.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rodolfo-Vieira-137167",
        },
      ],
      full_fight_history: [
        {
          opponent: "Andre Petroski",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "2/15/2025",
        },
        {
          opponent: "Armen Petrosyan",
          result: "Win",
          method: "Submission (Arm-Triangle Choke)",
          round: 1,
          time: "4:48",
          date: "2/10/2024",
        },
        {
          opponent: "Cody Brundage",
          result: "Win",
          method: "Submission (Arm-Triangle Choke)",
          round: 2,
          time: "1:28",
          date: "4/29/2023",
        },
      ],
      additional_stats: {
        ko_wins: 1,
        submission_wins: 9,
        first_round_finishes: 5,
      },
    },
    17: {
      bio: "Elizeu Zaleski dos Santos, nicknamed Capoeira, is a 38-year-old fighter from Francisco Beltrao, Parana, Brazil. Pro debut 2009, UFC debut April 16, 2016.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Elizeu-Zaleski-dos-Santos-63825",
        },
      ],
      full_fight_history: [
        {
          opponent: "Chidi Njokuani",
          result: "Loss",
          method: "TKO (Knee and Elbows)",
          round: 2,
          time: "2:19",
          date: "3/15/2025",
        },
        {
          opponent: "Zach Scroggin",
          result: "Win",
          method: "TKO (Punches)",
          round: 1,
          time: "1:15",
          date: "11/9/2024",
        },
        {
          opponent: "Randy Brown",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "6/1/2024",
        },
      ],
      additional_stats: {
        ko_wins: 15,
        submission_wins: 3,
        first_round_finishes: 0,
      },
    },
    18: {
      bio: "Neil Magny, nicknamed The Haitian Sensation, is a 37-year-old fighter from Brooklyn, New York, United States. Pro debut 2010, UFC debut February 23, 2013.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Neil-Magny-69166",
        },
      ],
      full_fight_history: [
        {
          opponent: "Carlos Prates",
          result: "Loss",
          method: "KO (Punch)",
          round: 1,
          time: "4:50",
          date: "11/9/2024",
        },
        {
          opponent: "Michael Morales",
          result: "Loss",
          method: "TKO (Punches)",
          round: 1,
          time: "4:39",
          date: "8/24/2024",
        },
        {
          opponent: "Mike Malott",
          result: "Win",
          method: "TKO (Punches)",
          round: 3,
          time: "4:45",
          date: "1/20/2024",
        },
      ],
      additional_stats: {
        ko_wins: 8,
        submission_wins: 4,
        first_round_finishes: 0,
      },
    },
    19: {
      bio: "Ketlen Souza bio not available. Upcoming fighter in UFC Fight Night Aug 2.",
      links: [],
      full_fight_history: [],
      additional_stats: {},
    },
    20: {
      bio: "Piera Rodriguez, nicknamed La Fiera, is a 32-year-old fighter from Maracaibo, Zulia, Venezuela. Pro debut 2017, UFC debut October 19, 2021.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Piera-Rodriguez-247469",
        },
      ],
      full_fight_history: [
        {
          opponent: "Josefine Lindgren Knutsson",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "12/14/2024",
        },
        {
          opponent: "Ariane Carnelossi",
          result: "Loss",
          method: "Disqualification (Headbutts)",
          round: 2,
          time: "3:16",
          date: "5/18/2024",
        },
        {
          opponent: "Gillian Robertson",
          result: "Loss",
          method: "Submission (Armbar)",
          round: 2,
          time: "4:21",
          date: "4/15/2023",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 0,
        first_round_finishes: 0,
      },
    },
    21: {
      bio: "Nora Cornolle, nicknamed Wonder, is a 35-year-old fighter from Epinay-sur-Seine, France. Fighting style: Muay Thai. Pro debut not specified, UFC debut September 2, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Nora-Cornolle-367103",
        },
      ],
      full_fight_history: [
        {
          opponent: "Hailey Cowan",
          result: "Win",
          method: "Submission (Rear-Naked Choke)",
          round: 2,
          time: "1:52",
          date: "4/12/2025",
        },
        {
          opponent: "Jacqueline Cavalcanti",
          result: "Loss",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "9/28/2024",
        },
        {
          opponent: "Melissa Mullins",
          result: "Win",
          method: "TKO (Knee to the Body and Head Kicks)",
          round: 2,
          time: "3:06",
          date: "4/6/2024",
        },
      ],
      additional_stats: {
        ko_wins: 6,
        submission_wins: 2,
        first_round_finishes: 3,
      },
    },
    22: {
      bio: "Karol Rosa is a 30-year-old fighter from Vila Velha, Espirito Santo, Brazil. Pro debut in 2012, UFC debut July 11, 2020.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Karol-Rosa-115135",
        },
      ],
      full_fight_history: [
        {
          opponent: "Ailin Perez",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "1/18/2025",
        },
        {
          opponent: "Pannie Kianzad",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "8/10/2024",
        },
        {
          opponent: "Irene Aldana",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "12/16/2023",
        },
      ],
      additional_stats: {
        ko_wins: 4,
        submission_wins: 2,
        first_round_finishes: 2,
      },
    },
    23: {
      bio: "Andrey Pulyaev is a 27-year-old fighter from Novosibirsk, Novosibirsk Oblast, Russia. Pro debut 2022, UFC debut March 22, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Andrey-Pulyaev-398399",
        },
      ],
      full_fight_history: [
        {
          opponent: "Christian Leroy Duncan",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "3/22/2025",
        },
        {
          opponent: "Liam Anderson",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "8/27/2024",
        },
        {
          opponent: "Weldon Silva de Oliveira",
          result: "Win",
          method: "KO (Punches)",
          round: 1,
          time: "1:17",
          date: "2/2/2024",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 2,
        first_round_finishes: 5,
      },
    },
    24: {
      bio: "Ludovit Klein, nicknamed Mr. Highlight, is a 30-year-old fighter from Nove Zamky, Slovakia. Pro debut 2014, UFC debut 2020.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Ludovit-Klein-183159",
        },
      ],
      full_fight_history: [
        {
          opponent: "Mateusz Gamrot",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "5/31/2025",
        },
        {
          opponent: "Roosevelt Roberts",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "9/28/2024",
        },
        {
          opponent: "Thiago Moises",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "6/8/2024",
        },
      ],
      additional_stats: {
        ko_wins: 9,
        submission_wins: 8,
        first_round_finishes: 11,
      },
    },
    25: {
      bio: "John Yannis bio not available. Upcoming fighter in UFC Fight Night Aug 2.",
      links: [],
      full_fight_history: [],
      additional_stats: {},
    },
    26: {
      bio: "Austin Bashi is a 23-year-old fighter from West Bloomfield Township, Michigan, United States. Pro debut in 2020, UFC debut January 11, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Austin-Bashi-362871",
        },
        {
          name: "UFC Stats",
          url: "http://ufcstats.com/fighter-details/d3f89fa685bd8420",
        },
      ],
      full_fight_history: [
        {
          opponent: "Christian Rodriguez",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "1/11/2025",
        },
        {
          opponent: "Dorian Ramos",
          result: "Win",
          method: "Submission (Rear-Naked Choke)",
          round: 2,
          time: "3:15",
          date: "9/3/2024",
        },
        {
          opponent: "Zac Riley",
          result: "Win",
          method: "TKO (Punches)",
          round: 1,
          time: "3:48",
          date: "6/1/2024",
        },
      ],
      additional_stats: {
        ko_wins: 3,
        submission_wins: 5,
        first_round_finishes: 4,
      },
    },
    27: {
      bio: "Felipe Bunes is a fighter from Brazil. Limited info available.",
      links: [],
      full_fight_history: [],
      additional_stats: {},
    },
    28: {
      bio: "Rafael Estevam, nicknamed Macapa, is a 28-year-old fighter from Macapa, Amapa, Brazil. Pro debut in 2015.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rafael-Estevam-200851",
        },
      ],
      full_fight_history: [
        {
          opponent: "Jesus Santos Aguilar",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "2/15/2025",
        },
        {
          opponent: "Charles Johnson",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "11/18/2023",
        },
        {
          opponent: "Joao Elias",
          result: "Win",
          method: "TKO (Punches)",
          round: 2,
          time: "2:25",
          date: "9/27/2022",
        },
      ],
      additional_stats: {
        ko_wins: 4,
        submission_wins: 3,
        first_round_finishes: 1,
      },
    },
    29: {
      bio: "Kevin Vallejos, nicknamed El Chino, is a 23-year-old fighter from Mar del Plata, Buenos Aires, Argentina. Pro debut in 2021, UFC debut March 15, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Kevin-Vallejos-391233",
        },
      ],
      full_fight_history: [
        {
          opponent: "Seung Woo Choi",
          result: "Win",
          method: "TKO (Punches)",
          round: 1,
          time: "3:09",
          date: "3/15/2025",
        },
        {
          opponent: "Cam Teague",
          result: "Win",
          method: "TKO (Punches)",
          round: 1,
          time: "2:23",
          date: "9/24/2024",
        },
        {
          opponent: "Gonzalo Contreras",
          result: "Win",
          method: "KO (Punch)",
          round: 2,
          time: "4:23",
          date: "3/2/2024",
        },
      ],
      additional_stats: {
        ko_wins: 11,
        submission_wins: 2,
        first_round_finishes: 6,
      },
    },
    30: {
      bio: "Danny Silva, nicknamed Puma, is a 28-year-old fighter from Santa Ana, California, United States. Fighting style: Boxing. Pro debut in 2019, UFC debut September 26, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Danny-Silva-310429",
        },
      ],
      full_fight_history: [
        {
          opponent: "Lucas Almeida",
          result: "Win",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "3/1/2025",
        },
        {
          opponent: "Joshua Culibao",
          result: "Win",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "3/16/2024",
        },
        {
          opponent: "Angel Pacheco",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "9/26/2023",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 0,
        first_round_finishes: 3,
      },
    },
    31: {
      bio: "Nathan Fletcher is a 27-year-old fighter from Liverpool, England. Pro debut in 2019, UFC debut March 22, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Nathan-Fletcher-275293",
        },
      ],
      full_fight_history: [
        {
          opponent: "Caolan Loughran",
          result: "Loss",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "3/22/2025",
        },
        {
          opponent: "Zygimantas Ramaska",
          result: "Win",
          method: "Submission (Arm-Triangle Choke)",
          round: 2,
          time: "1:14",
          date: "9/7/2024",
        },
        {
          opponent: "Daan Duijs",
          result: "Win",
          method: "Submission (Triangle Choke)",
          round: 1,
          time: "4:15",
          date: "4/15/2023",
        },
      ],
      additional_stats: {
        ko_wins: 1,
        submission_wins: 7,
        first_round_finishes: 4,
      },
    },
    32: {
      bio: "Rinya Nakamura, nicknamed Hybrid, is a 30-year-old fighter from Saitama, Japan. Pro debut not specified, UFC debut February 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rinya-Nakamura-386855",
        },
      ],
      full_fight_history: [
        {
          opponent: "Muin Gafurov",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "1/18/2025",
        },
        {
          opponent: "Carlos Vera",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "2/17/2024",
        },
        {
          opponent: "Fernie Garcia",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "8/26/2023",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 1,
        first_round_finishes: 5,
      },
    },
    33: {
      bio: "HyunSung Park, nicknamed Peace of Mind, is a 29-year-old fighter from Gyeonggi, South Korea. Pro debut 2018, UFC debut February 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Hyun-Sung-Park-289999",
        },
      ],
      full_fight_history: [
        {
          opponent: "Carlos Hernandez",
          result: "Win",
          method: "Submission (Rear-Naked Choke)",
          round: 1,
          time: "2:26",
          date: "5/17/2025",
        },
        {
          opponent: "Shannon Ross",
          result: "Win",
          method: "TKO (Knee and Punches)",
          round: 2,
          time: "3:59",
          date: "12/9/2023",
        },
        {
          opponent: "Seung Guk Choi",
          result: "Win",
          method: "Submission (Rear-Naked Choke)",
          round: 3,
          time: "3:11",
          date: "2/4/2023",
        },
      ],
      additional_stats: {
        ko_wins: 4,
        submission_wins: 5,
        first_round_finishes: 4,
      },
    },
    34: {
      bio: "Tatsuro Taira is a 25-year-old fighter from Naha, Okinawa, Japan. Pro debut in 2018, UFC debut 2022.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Tatsuro-Taira-293975",
        },
      ],
      full_fight_history: [
        {
          opponent: "Brandon Royval",
          result: "Loss",
          method: "Decision (Split)",
          round: 5,
          time: "5:00",
          date: "10/12/2024",
        },
        {
          opponent: "Alex Perez",
          result: "Win",
          method: "TKO (Knee Injury)",
          round: 2,
          time: "2:59",
          date: "6/15/2024",
        },
        {
          opponent: "Carlos Hernandez",
          result: "Win",
          method: "TKO (Punches)",
          round: 2,
          time: "0:55",
          date: "12/9/2023",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 7,
        first_round_finishes: 7,
      },
    },
    35: {
      bio: "Esteban Ribovics, nicknamed El Gringo, is a 29-year-old fighter from Tartagal, Salta, Argentina. Pro debut in 2015, UFC debut March 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Esteban-Ribovics-214867",
        },
      ],
      full_fight_history: [
        {
          opponent: "Nasrat Haqparast",
          result: "Loss",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "3/1/2025",
        },
        {
          opponent: "Daniel Zellhuber",
          result: "Win",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "9/14/2024",
        },
        {
          opponent: "Terrance McKinney",
          result: "Win",
          method: "KO (Head Kick)",
          round: 1,
          time: "0:37",
          date: "5/11/2024",
        },
      ],
      additional_stats: {
        ko_wins: 7,
        submission_wins: 5,
        first_round_finishes: 7,
      },
    },
    36: {
      bio: "Elves Brener is a 27-year-old fighter from Maues, Amazonas, Brazil. Pro debut in 2016, UFC debut February 11, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Elves-Brener-224229",
        },
      ],
      full_fight_history: [
        {
          opponent: "Joel Alvarez",
          result: "Loss",
          method: "TKO (Knees and Punches)",
          round: 3,
          time: "3:36",
          date: "8/3/2024",
        },
        {
          opponent: "Myktybek Orolbai",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "5/4/2024",
        },
        {
          opponent: "Kaynan Kruschewsky",
          result: "Win",
          method: "KO (Punch)",
          round: 1,
          time: "4:01",
          date: "11/4/2023",
        },
      ],
      additional_stats: {
        ko_wins: 3,
        submission_wins: 11,
        first_round_finishes: 9,
      },
    },
    37: {
      bio: "Chris Duncan, nicknamed The Problem, is a 32-year-old fighter from Alloa, East Ayrshire, Scotland. Pro debut in 2018, UFC debut March 18, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Chris-Duncan-74346",
        },
      ],
      full_fight_history: [
        {
          opponent: "Jordan Vucenic",
          result: "Win",
          method: "Submission (Guillotine Choke)",
          round: 2,
          time: "3:42",
          date: "3/22/2025",
        },
        {
          opponent: "Bolaji Oki",
          result: "Win",
          method: "Technical Submission (Guillotine Choke)",
          round: 1,
          time: "3:34",
          date: "9/28/2024",
        },
        {
          opponent: "Manuel Torres",
          result: "Loss",
          method: "Submission (Rear-Naked Choke)",
          round: 1,
          time: "1:46",
          date: "2/24/2024",
        },
      ],
      additional_stats: {
        ko_wins: 7,
        submission_wins: 3,
        first_round_finishes: 6,
      },
    },
    38: {
      bio: "Mateusz Rebecki, nicknamed Chinczyk, is a 32-year-old fighter from Szczecin, Poland. Pro debut in 2014, UFC debut 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Mateusz-Rebecki-146417",
        },
      ],
      full_fight_history: [
        {
          opponent: "Myktybek Orolbai",
          result: "Win",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "10/26/2024",
        },
        {
          opponent: "Diego Ferreira",
          result: "Loss",
          method: "TKO (Punches)",
          round: 3,
          time: "4:51",
          date: "5/11/2024",
        },
        {
          opponent: "Roosevelt Roberts",
          result: "Win",
          method: "Submission (Armbar)",
          round: 1,
          time: "3:08",
          date: "11/11/2023",
        },
      ],
      additional_stats: {
        ko_wins: 9,
        submission_wins: 7,
        first_round_finishes: 9,
      },
    },
    39: {
      bio: "Tresean Gore, nicknamed Mr. Vicious, is a 31-year-old fighter from Myrtle Beach, South Carolina, United States. Pro debut in 2018, UFC debut February 5, 2022.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Tresean-Gore-289719",
        },
      ],
      full_fight_history: [
        {
          opponent: "Marco Tulio",
          result: "Loss",
          method: "TKO (Punch)",
          round: 2,
          time: "3:16",
          date: "4/12/2025",
        },
        {
          opponent: "Antonio Trocoli",
          result: "Win",
          method: "Submission (Guillotine Choke)",
          round: 1,
          time: "1:23",
          date: "11/9/2024",
        },
        {
          opponent: "Josh Fremd",
          result: "Win",
          method: "Technical Submission (Guillotine Choke)",
          round: 2,
          time: "0:49",
          date: "10/29/2022",
        },
      ],
      additional_stats: {
        ko_wins: 1,
        submission_wins: 3,
        first_round_finishes: 3,
      },
    },
    40: {
      bio: "Rodolfo Vieira, nicknamed The Black Belt Hunter, is a 35-year-old fighter from Rio de Janeiro, Rio de Janeiro, Brazil. Pro debut not specified, UFC debut not specified.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rodolfo-Vieira-137167",
        },
      ],
      full_fight_history: [
        {
          opponent: "Andre Petroski",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "2/15/2025",
        },
        {
          opponent: "Armen Petrosyan",
          result: "Win",
          method: "Submission (Arm-Triangle Choke)",
          round: 1,
          time: "4:48",
          date: "2/10/2024",
        },
        {
          opponent: "Cody Brundage",
          result: "Win",
          method: "Submission (Arm-Triangle Choke)",
          round: 2,
          time: "1:28",
          date: "4/29/2023",
        },
      ],
      additional_stats: {
        ko_wins: 1,
        submission_wins: 9,
        first_round_finishes: 5,
      },
    },
    41: {
      bio: "Elizeu Zaleski dos Santos, nicknamed Capoeira, is a 38-year-old fighter from Francisco Beltrao, Parana, Brazil. Pro debut 2009, UFC debut April 16, 2016.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Elizeu-Zaleski-dos-Santos-63825",
        },
      ],
      full_fight_history: [
        {
          opponent: "Chidi Njokuani",
          result: "Loss",
          method: "TKO (Knee and Elbows)",
          round: 2,
          time: "2:19",
          date: "3/15/2025",
        },
        {
          opponent: "Zach Scroggin",
          result: "Win",
          method: "TKO (Punches)",
          round: 1,
          time: "1:15",
          date: "11/9/2024",
        },
        {
          opponent: "Randy Brown",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "6/1/2024",
        },
      ],
      additional_stats: {
        ko_wins: 15,
        submission_wins: 3,
        first_round_finishes: 0,
      },
    },
    42: {
      bio: "Neil Magny, nicknamed The Haitian Sensation, is a 37-year-old fighter from Brooklyn, New York, United States. Pro debut 2010, UFC debut February 23, 2013.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Neil-Magny-69166",
        },
      ],
      full_fight_history: [
        {
          opponent: "Carlos Prates",
          result: "Loss",
          method: "KO (Punch)",
          round: 1,
          time: "4:50",
          date: "11/9/2024",
        },
        {
          opponent: "Michael Morales",
          result: "Loss",
          method: "TKO (Punches)",
          round: 1,
          time: "4:39",
          date: "8/24/2024",
        },
        {
          opponent: "Mike Malott",
          result: "Win",
          method: "TKO (Punches)",
          round: 3,
          time: "4:45",
          date: "1/20/2024",
        },
      ],
      additional_stats: {
        ko_wins: 8,
        submission_wins: 4,
        first_round_finishes: 0,
      },
    },
    43: {
      bio: "Ketlen Souza bio not available. Upcoming fighter in UFC Fight Night Aug 2.",
      links: [],
      full_fight_history: [],
      additional_stats: {},
    },
    44: {
      bio: "Piera Rodriguez, nicknamed La Fiera, is a 32-year-old fighter from Maracaibo, Zulia, Venezuela. Pro debut 2017, UFC debut October 19, 2021.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Piera-Rodriguez-247469",
        },
      ],
      full_fight_history: [
        {
          opponent: "Josefine Lindgren Knutsson",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "12/14/2024",
        },
        {
          opponent: "Ariane Carnelossi",
          result: "Loss",
          method: "Disqualification (Headbutts)",
          round: 2,
          time: "3:16",
          date: "5/18/2024",
        },
        {
          opponent: "Gillian Robertson",
          result: "Loss",
          method: "Submission (Armbar)",
          round: 2,
          time: "4:21",
          date: "4/15/2023",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 0,
        first_round_finishes: 0,
      },
    },
    45: {
      bio: "Nora Cornolle, nicknamed Wonder, is a 35-year-old fighter from Epinay-sur-Seine, France. Fighting style: Muay Thai. Pro debut not specified, UFC debut September 2, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Nora-Cornolle-367103",
        },
      ],
      full_fight_history: [
        {
          opponent: "Hailey Cowan",
          result: "Win",
          method: "Submission (Rear-Naked Choke)",
          round: 2,
          time: "1:52",
          date: "4/12/2025",
        },
        {
          opponent: "Jacqueline Cavalcanti",
          result: "Loss",
          method: "Decision (Split)",
          round: 3,
          time: "5:00",
          date: "9/28/2024",
        },
        {
          opponent: "Melissa Mullins",
          result: "Win",
          method: "TKO (Knee to the Body and Head Kicks)",
          round: 2,
          time: "3:06",
          date: "4/6/2024",
        },
      ],
      additional_stats: {
        ko_wins: 6,
        submission_wins: 2,
        first_round_finishes: 3,
      },
    },
    46: {
      bio: "Karol Rosa is a 30-year-old fighter from Vila Velha, Espirito Santo, Brazil. Pro debut in 2012, UFC debut July 11, 2020.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Karol-Rosa-115135",
        },
      ],
      full_fight_history: [
        {
          opponent: "Ailin Perez",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "1/18/2025",
        },
        {
          opponent: "Pannie Kianzad",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "8/10/2024",
        },
        {
          opponent: "Irene Aldana",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "12/16/2023",
        },
      ],
      additional_stats: {
        ko_wins: 4,
        submission_wins: 2,
        first_round_finishes: 2,
      },
    },
    47: {
      bio: "Andrey Pulyaev is a 27-year-old fighter from Novosibirsk, Novosibirsk Oblast, Russia. Pro debut 2022, UFC debut March 22, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Andrey-Pulyaev-398399",
        },
      ],
      full_fight_history: [
        {
          opponent: "Christian Leroy Duncan",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "3/22/2025",
        },
        {
          opponent: "Liam Anderson",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "8/27/2024",
        },
        {
          opponent: "Weldon Silva de Oliveira",
          result: "Win",
          method: "KO (Punches)",
          round: 1,
          time: "1:17",
          date: "2/2/2024",
        },
      ],
      additional_stats: {
        ko_wins: 5,
        submission_wins: 2,
        first_round_finishes: 5,
      },
    },
    48: {
      bio: "Ludovit Klein, nicknamed Mr. Highlight, is a 30-year-old fighter from Nove Zamky, Slovakia. Pro debut 2014, UFC debut 2020.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Ludovit-Klein-183159",
        },
      ],
      full_fight_history: [
        {
          opponent: "Mateusz Gamrot",
          result: "Loss",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "5/31/2025",
        },
        {
          opponent: "Roosevelt Roberts",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "9/28/2024",
        },
        {
          opponent: "Thiago Moises",
          result: "Win",
          method: "Decision (Unanimous)",
          round: 3,
          time: "5:00",
          date: "6/8/2024",
        },
      ],
      additional_stats: {
        ko_wins: 9,
        submission_wins: 8,
        first_round_finishes: 11,
      },
    },
  }; // End of enhancedInfos object

  useEffect(() => {
    fetch("/fighters.json")
      .then((res) => res.json())
      .then((data) => {
        const foundFighter = data.find((f) => f.id === parseInt(id));
        if (foundFighter) {
          const enhancedData = {
            ...foundFighter,
            ...(enhancedInfos[id] || {
              bio: "Bio coming soon...",
              links: [],
              full_fight_history: [],
              additional_stats: {},
            }),
          };
          setFighter(enhancedData);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) return <>Loading...</>;
  if (!fighter) return <>Fighter not found.</>;
  return (
    <div className="fighter-bio-container">
      <h2 className="text-2xl font-bold mb-2">{fighter.name} Bio</h2>
      <img
        src={`/fighter-${fighter.id}.jpg`}
        alt={fighter.name}
        className="w-full h-64 object-cover rounded-lg mb-4 pearl-border"
        onError={(e) => (e.target.src = "https://picsum.photos/400/300")}
      />
      <p className="mb-4">{fighter.bio}</p>
      <h3 className="text-lg font-semibold mb-2">Additional Stats</h3>
      <ul className="mb-4">
        <li>KO Wins: {fighter.additional_stats.ko_wins || "N/A"}</li>
        <li>
          Submission Wins: {fighter.additional_stats.submission_wins || "N/A"}
        </li>
        <li>
          First Round Finishes:{" "}
          {fighter.additional_stats.first_round_finishes || "N/A"}
        </li>
      </ul>
      <h3 className="text-lg font-semibold mb-2">Links</h3>
      <ul className="mb-4">
        {fighter.links.map((link, index) => (
          <li key={index}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {link.name}
            </a>
          </li>
        ))}
        <li>
          <a
            href="https://ufcfightpass.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            Sign Up for UFC Fight Pass (for full fight videos)
          </a>
        </li>
      </ul>
      <h3 className="text-lg font-semibold mb-2">Full Fight History</h3>
      <ul>
        {fighter.full_fight_history.map((fight, index) => (
          <li key={index}>
            vs. {fight.opponent} - {fight.result} ({fight.method}, Round{" "}
            {fight.round}, Time {fight.time}, {fight.date}){" "}
            {fight.notes ? `- ${fight.notes}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FighterBio;
