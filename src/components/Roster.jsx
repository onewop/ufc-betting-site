import React, { useState, useEffect } from "react";

const Roster = () => {
  const [fighters, setFighters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedFighter, setExpandedFighter] = useState(null);

  const enhancedInfos = {
    1: {
      bio: "Max Holloway, nicknamed 'Blessed,' is a 33-year-old fighter from Waianae, United States. He trains at Hawaii Elite MMA in Hawaii and fights in a Muay Thai style. He turned pro in 2010, debuted in the UFC on February 4, 2012, and is a former UFC featherweight champion. He also held the 155 title for X-1 world events and won three amateur 145-pound belts. He is a brown belt in jiu-jitsu, with favorite techniques including the arm bar and flying knee.",
      links: [
        {
          name: "Facebook",
          url: "https://www.facebook.com/maxhollowayofficial/",
        },
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Max-Holloway-38671",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/max-holloway",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Win vs. Dustin Poirier by unanimous decision (5 rounds, retained UFC BMF title).",
        "UFC 308 (10/30/24): Loss vs. Ilia Topuria by KO (Round 3, 1:34, UFC featherweight title).",
        "UFC 300 (4/13/24): Win vs. Justin Gaethje by KO (Round 5, 4:59, won BMF title).",
      ],
    },
    2: {
      bio: "Dustin Poirier, nicknamed 'The Diamond,' is a 36-year-old fighter from Lafayette, United States. He trains at American Top Team ATT in Coconut Creek, FL, with a Jiu-Jitsu fighting style, holding a black belt in BJJ. He turned pro in 2009, debuted in the UFC on January 2, 2011, and is a former interim UFC lightweight champion. Notable titles include three pro belts at 155lbs and amateur achievements like an 8-man tournament win.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Dustin-Poirier-50529",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/dustin-poirier",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Loss vs. Max Holloway by unanimous decision (5 rounds, UFC BMF title).",
        "UFC 302 (6/1/24): Loss vs. Islam Makhachev by submission (D'arce choke, Round 5, 2:42, UFC lightweight title).",
        "UFC 299 (3/9/24): Win vs. Benoît Saint Denis by knockout (Round 2, 2:32).",
      ],
    },
    3: {
      bio: "Marvin Vettori, nicknamed 'The Italian Dream,' is a 31-year-old fighter from Trento, Italy. He trains at Kings MMA in Huntington Beach, CA, with an MMA fighting style. He turned pro in 2012, debuted in the UFC on August 21, 2016, and is a brown belt in BJJ. He won the Venator FC welterweight title and was inspired by Fedor Emelianenko.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Marvin-Vettori-80421",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/marvin-vettori",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Loss vs. Brendan Allen by unanimous decision (3 rounds).",
        "UFC Fight Night (3/15/25): Loss vs. Roman Dolidze by unanimous decision (5 rounds).",
        "UFC on ESPN (6/17/23): Loss vs. Jared Cannonier by unanimous decision (5 rounds).",
      ],
    },
    4: {
      bio: "Brendan Allen, nicknamed 'All In,' is a 29-year-old fighter from Beaufort, United States. He trains at Kill Cliff FC with an MMA fighting style. He turned pro in 2015, debuted in the UFC on October 18, 2019, and holds a black belt in BJJ. Notable titles include LFA and Valor Fights middleweight champion, 2015 IMMAF world champion.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Brendan-Allen-201703",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/brendan-allen",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Win vs. Marvin Vettori by unanimous decision (3 rounds).",
        "UFC Fight Night (2/22/25): Loss vs. Anthony Hernandez by unanimous decision (3 rounds).",
        "UFC Fight Night (9/28/24): Loss vs. Nassourdine Imavov by unanimous decision (3 rounds).",
      ],
    },
    5: {
      bio: "Paulo Costa, nicknamed 'The Eraser,' is a 34-year-old fighter from the State of Minas Gerais, Brazil. He trains at Team Borracha with a striker fighting style. He turned pro in 2012, debuted in the UFC on March 12, 2017. Notable titles include Mineiro Champion of Jiu-Jitsu and Middleweight Champion for Face to Face and Jungle Fight Events.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Paulo-Costa-121141",
        },
        { name: "UFC Profile", url: "https://www.ufc.com/athlete/paulo-costa" },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Win vs. Roman Kopylov by unanimous decision (3 rounds).",
        "UFC 302 (6/1/24): Loss vs. Sean Strickland by split decision (5 rounds).",
        "UFC 298 (2/17/24): Loss vs. Robert Whittaker by unanimous decision (3 rounds).",
      ],
    },
    6: {
      bio: "Roman Kopylov is a 33-year-old fighter from Kemerovo Oblast, Russia. Morning sessions include wrestling or striking technique; evening sessions involve pair work and sparring. He prefers double leg takedown for grappling and boxing combos for striking. He turned pro in 2016, debuted in the UFC on November 9, 2019. Notable titles include former Fight Nights Global Middleweight Champion and multiple hand-to-hand combat championships.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Roman-Kopylov-232601",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/roman-kopylov",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Loss vs. Paulo Costa by unanimous decision (3 rounds).",
        "UFC Fight Night (1/11/25): Win vs. Chris Curtis by KO (high kick, Round 3, 4:59).",
        "UFC 302 (6/1/24): Win vs. Cesar Almeida by split decision (3 rounds).",
      ],
    },
    7: {
      bio: "Kevin Holland, nicknamed 'Trailblazer,' is a 32-year-old fighter from Riverside, United States. Daily schedule includes morning run, lifting, striking, and jiu-jitsu sessions. He fights in a Kung Fu style, turned pro in 2015, debuted in the UFC on August 4, 2018. Notable titles include KOTC K170 interim champ, KKO 170 and 185lb belts, second-degree black belt in kung fu, black belt in jiu-jitsu.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Kevin-Holland-108999",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/kevin-holland",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Loss vs. Daniel Rodriguez by unanimous decision (3 rounds).",
        "UFC 316 (6/7/25): Win vs. Vicente Luque by submission (D'arce choke, Round 2, 1:03).",
        "UFC Fight Night (3/22/25): Win vs. Gunnar Nelson by unanimous decision (3 rounds).",
      ],
    },
    8: {
      bio: "Daniel Rodriguez, nicknamed 'D-Rod,' is a 38-year-old fighter from Los Angeles, United States. He trains at 10th Planet Jiu-Jitsu with a freestyle fighting style. He turned pro in 2015, debuted in the UFC on February 15, 2020. Notable titles include #2 ranked in California with a jiu-jitsu purple belt, two-time amateur champion, 7-0 amateur record.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Daniel-Rodriguez-145945",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/daniel-rodriguez",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Win vs. Kevin Holland by unanimous decision (3 rounds).",
        "UFC on ESPN (5/3/25): Win vs. Santiago Ponzinibbio by strikes (Round 3, 1:12).",
        "UFC Fight Night (10/12/24): Win vs. Alex Morono by split decision (3 rounds).",
      ],
    },
    9: {
      bio: "Kyler Phillips, nicknamed 'The Matrix,' is a 30-year-old fighter from Torrance, United States. He started at Gracie Academy at age 3, holds Carlson Gracie Jiu-Jitsu black belt and Carlson Gracie red/black belt. Fighting style includes multi-dimensional martial arts with techniques like Matrix armbar. He turned pro in 2016, debuted in the UFC on August 1, 2017. Notable titles include 2012 IBJJF world champion, 2013 CIF wrestling champion.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Kyler-Phillips-190919",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/kyler-phillips",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Loss vs. Vinicius Oliveira by unanimous decision (3 rounds).",
        "UFC Fight Night (10/19/24): Loss vs. Rob Font by unanimous decision (3 rounds).",
        "UFC 299 (3/9/24): Win vs. Pedro Munhoz by unanimous decision (3 rounds).",
      ],
    },
    10: {
      bio: "Vinicius Oliveira, nicknamed 'LokDog,' is a 29-year-old fighter from Porto Alegre, Brazil. He started martial arts for self-defense, holds BJJ purple belt. He turned pro in 2015, debuted in the UFC on March 2, 2024. Notable titles include two-time UAE Warriors champion.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Vinicius-Oliveira-139517",
        },
        {
          name: "UFC Profile",
          url: "https://www.ufc.com/athlete/vinicius-oliveira",
        },
      ],
      lastThreeFights: [
        "UFC 318 (7/19/25): Win vs. Kyler Phillips by unanimous decision (3 rounds).",
        "UFC Fight Night (2/1/25): Win vs. Said Nurmagomedov by unanimous decision (3 rounds).",
        "UFC 303 (6/29/24): Win vs. Ricky Simon by unanimous decision (3 rounds).",
      ],
    },
    25: {
      bio: "John Yannis bio not available. Upcoming fighter in UFC Fight Night Aug 2.",
      links: [],
      lastThreeFights: [],
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
      lastThreeFights: [
        "UFC Fight Night (1/11/25): Loss vs. Christian Rodriguez by unanimous decision (3 rounds, 5:00).",
        "LFA (9/3/24): Win vs. Dorian Ramos by submission (Rear-Naked Choke, Round 2, 3:15).",
        "LFA (6/1/24): Win vs. Zac Riley by TKO (Punches, Round 1, 3:48).",
      ],
    },
    27: {
      bio: "Felipe Bunes is a fighter from Brazil. Limited info available.",
      links: [],
      lastThreeFights: [],
    },
    28: {
      bio: "Rafael Estevam, nicknamed Macapa, is a 28-year-old fighter from Macapa, Amapa, Brazil. Pro debut in 2015.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rafael-Estevam-200851",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (2/15/25): Win vs. Jesus Santos Aguilar by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (11/18/23): Win vs. Charles Johnson by unanimous decision (3 rounds, 5:00).",
        "LFA (9/27/22): Win vs. Joao Elias by TKO (Punches, Round 2, 2:25).",
      ],
    },
    29: {
      bio: "Kevin Vallejos, nicknamed El Chino, is a 23-year-old fighter from Mar del Plata, Buenos Aires, Argentina. Pro debut in 2021, UFC debut March 15, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Kevin-Vallejos-391233",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (3/15/25): Win vs. Seung Woo Choi by TKO (Punches, Round 1, 3:09).",
        "LFA (9/24/24): Win vs. Cam Teague by TKO (Punches, Round 1, 2:23).",
        "LFA (3/2/24): Win vs. Gonzalo Contreras by KO (Punch, Round 2, 4:23).",
      ],
    },
    30: {
      bio: "Danny Silva, nicknamed Puma, is a 28-year-old fighter from Santa Ana, California, United States. Fighting style: Boxing. Pro debut in 2019, UFC debut September 26, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Danny-Silva-310429",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (3/1/25): Win vs. Lucas Almeida by split decision (3 rounds, 5:00).",
        "UFC Fight Night (3/16/24): Win vs. Joshua Culibao by split decision (3 rounds, 5:00).",
        "UFC Fight Night (9/26/23): Win vs. Angel Pacheco by unanimous decision (3 rounds, 5:00).",
      ],
    },
    31: {
      bio: "Nathan Fletcher is a 27-year-old fighter from Liverpool, England. Pro debut in 2019, UFC debut March 22, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Nathan-Fletcher-275293",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (3/22/25): Loss vs. Caolan Loughran by split decision (3 rounds, 5:00).",
        "Cage Warriors (9/7/24): Win vs. Zygimantas Ramaska by submission (Arm-Triangle Choke, Round 2, 1:14).",
        "Cage Warriors (4/15/23): Win vs. Daan Duijs by submission (Triangle Choke, Round 1, 4:15).",
      ],
    },
    32: {
      bio: "Rinya Nakamura, nicknamed Hybrid, is a 30-year-old fighter from Saitama, Japan. Pro debut not specified, UFC debut February 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rinya-Nakamura-386855",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (1/18/25): Loss vs. Muin Gafurov by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (2/17/24): Win vs. Carlos Vera by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (8/26/23): Win vs. Fernie Garcia by unanimous decision (3 rounds, 5:00).",
      ],
    },
    33: {
      bio: "HyunSung Park, nicknamed Peace of Mind, is a 29-year-old fighter from Gyeonggi, South Korea. Pro debut 2018, UFC debut February 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Hyun-Sung-Park-289999",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (5/17/25): Win vs. Carlos Hernandez by submission (Rear-Naked Choke, Round 1, 2:26).",
        "UFC Fight Night (12/9/23): Win vs. Shannon Ross by TKO (Knee and Punches, Round 2, 3:59).",
        "UFC Fight Night (2/4/23): Win vs. Seung Guk Choi by submission (Rear-Naked Choke, Round 3, 3:11).",
      ],
    },
    34: {
      bio: "Tatsuro Taira is a 25-year-old fighter from Naha, Okinawa, Japan. Pro debut in 2018, UFC debut 2022.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Tatsuro-Taira-293975",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (10/12/24): Loss vs. Brandon Royval by split decision (5 rounds, 5:00).",
        "UFC Fight Night (6/15/24): Win vs. Alex Perez by TKO (Knee Injury, Round 2, 2:59).",
        "UFC Fight Night (12/9/23): Win vs. Carlos Hernandez by TKO (Punches, Round 2, 0:55).",
      ],
    },
    35: {
      bio: "Esteban Ribovics, nicknamed El Gringo, is a 29-year-old fighter from Tartagal, Salta, Argentina. Pro debut in 2015, UFC debut March 4, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Esteban-Ribovics-214867",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (3/1/25): Loss vs. Nasrat Haqparast by split decision (3 rounds, 5:00).",
        "UFC Fight Night (9/14/24): Win vs. Daniel Zellhuber by split decision (3 rounds, 5:00).",
        "UFC Fight Night (5/11/24): Win vs. Terrance McKinney by KO (Head Kick, Round 1, 0:37).",
      ],
    },
    36: {
      bio: "Elves Brener is a 27-year-old fighter from Maues, Amazonas, Brazil. Pro debut in 2016, UFC debut February 11, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Elves-Brener-224229",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (8/3/24): Loss vs. Joel Alvarez by TKO (Knees and Punches, Round 3, 3:36).",
        "UFC Fight Night (5/4/24): Loss vs. Myktybek Orolbai by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (11/4/23): Win vs. Kaynan Kruschewsky by KO (Punch, Round 1, 4:01).",
      ],
    },
    37: {
      bio: "Chris Duncan, nicknamed The Problem, is a 32-year-old fighter from Alloa, East Ayrshire, Scotland. Pro debut in 2018, UFC debut March 18, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Chris-Duncan-74346",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (3/22/25): Win vs. Jordan Vucenic by submission (Guillotine Choke, Round 2, 3:42).",
        "UFC Fight Night (9/28/24): Win vs. Bolaji Oki by technical submission (Guillotine Choke, Round 1, 3:34).",
        "UFC Fight Night (2/24/24): Loss vs. Manuel Torres by submission (Rear-Naked Choke, Round 1, 1:46).",
      ],
    },
    38: {
      bio: "Mateusz Rebecki, nicknamed Chinczyk, is a 32-year-old fighter from Szczecin, Poland. Pro debut in 2014, UFC debut 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Mateusz-Rebecki-146417",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (10/26/24): Win vs. Myktybek Orolbai by split decision (3 rounds, 5:00).",
        "UFC Fight Night (5/11/24): Loss vs. Diego Ferreira by TKO (Punches, Round 3, 4:51).",
        "UFC Fight Night (11/11/23): Win vs. Roosevelt Roberts by submission (Armbar, Round 1, 3:08).",
      ],
    },
    39: {
      bio: "Tresean Gore, nicknamed Mr. Vicious, is a 31-year-old fighter from Myrtle Beach, South Carolina, United States. Pro debut in 2018, UFC debut February 5, 2022.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Tresean-Gore-289719",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (4/12/25): Loss vs. Marco Tulio by TKO (Punch, Round 2, 3:16).",
        "UFC Fight Night (11/9/24): Win vs. Antonio Trocoli by submission (Guillotine Choke, Round 1, 1:23).",
        "UFC Fight Night (10/29/22): Win vs. Josh Fremd by technical submission (Guillotine Choke, Round 2, 0:49).",
      ],
    },
    40: {
      bio: "Rodolfo Vieira, nicknamed The Black Belt Hunter, is a 35-year-old fighter from Rio de Janeiro, Rio de Janeiro, Brazil. Pro debut not specified, UFC debut not specified.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Rodolfo-Vieira-137167",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (2/15/25): Loss vs. Andre Petroski by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (2/10/24): Win vs. Armen Petrosyan by submission (Arm-Triangle Choke, Round 1, 4:48).",
        "UFC Fight Night (4/29/23): Win vs. Cody Brundage by submission (Arm-Triangle Choke, Round 2, 1:28).",
      ],
    },
    41: {
      bio: "Elizeu Zaleski dos Santos, nicknamed Capoeira, is a 38-year-old fighter from Francisco Beltrao, Parana, Brazil. Pro debut 2009, UFC debut April 16, 2016.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Elizeu-Zaleski-dos-Santos-63825",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (3/15/25): Loss vs. Chidi Njokuani by TKO (Knee and Elbows, Round 2, 2:19).",
        "UFC Fight Night (11/9/24): Win vs. Zach Scroggin by TKO (Punches, Round 1, 1:15).",
        "UFC 302 (6/1/24): Loss vs. Randy Brown by unanimous decision (3 rounds, 5:00).",
      ],
    },
    42: {
      bio: "Neil Magny, nicknamed The Haitian Sensation, is a 37-year-old fighter from Brooklyn, New York, United States. Pro debut 2010, UFC debut February 23, 2013.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Neil-Magny-69166",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (11/9/24): Loss vs. Carlos Prates by KO (Punch, Round 1, 4:50).",
        "UFC Fight Night (8/24/24): Loss vs. Michael Morales by TKO (Punches, Round 1, 4:39).",
        "UFC Fight Night (1/20/24): Win vs. Mike Malott by TKO (Punches, Round 3, 4:45).",
      ],
    },
    43: {
      bio: "Ketlen Souza bio not available. Upcoming fighter in UFC Fight Night Aug 2.",
      links: [],
      lastThreeFights: [],
    },
    44: {
      bio: "Piera Rodriguez, nicknamed La Fiera, is a 32-year-old fighter from Maracaibo, Zulia, Venezuela. Pro debut 2017, UFC debut October 19, 2021.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Piera-Rodriguez-247469",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (12/14/24): Win vs. Josefine Lindgren Knutsson by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (5/18/24): Loss vs. Ariane Carnelossi by disqualification (Headbutts, Round 2, 3:16).",
        "UFC Fight Night (4/15/23): Loss vs. Gillian Robertson by submission (Armbar, Round 2, 4:21).",
      ],
    },
    45: {
      bio: "Nora Cornolle, nicknamed Wonder, is a 35-year-old fighter from Epinay-sur-Seine, France. Fighting style: Muay Thai. Pro debut not specified, UFC debut September 2, 2023.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Nora-Cornolle-367103",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (4/12/25): Win vs. Hailey Cowan by submission (Rear-Naked Choke, Round 2, 1:52).",
        "UFC Fight Night (9/28/24): Loss vs. Jacqueline Cavalcanti by split decision (3 rounds, 5:00).",
        "UFC Fight Night (4/6/24): Win vs. Melissa Mullins by TKO (Knee to the Body and Head Kicks, Round 2, 3:06).",
      ],
    },
    46: {
      bio: "Karol Rosa is a 30-year-old fighter from Vila Velha, Espirito Santo, Brazil. Pro debut in 2012, UFC debut July 11, 2020.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Karol-Rosa-115135",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (1/18/25): Loss vs. Ailin Perez by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (8/10/24): Win vs. Pannie Kianzad by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (12/16/23): Loss vs. Irene Aldana by unanimous decision (3 rounds, 5:00).",
      ],
    },
    47: {
      bio: "Andrey Pulyaev is a 27-year-old fighter from Novosibirsk, Novosibirsk Oblast, Russia. Pro debut 2022, UFC debut March 22, 2025.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Andrey-Pulyaev-398399",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (3/22/25): Loss vs. Christian Leroy Duncan by unanimous decision (3 rounds, 5:00).",
        "RCC (8/27/24): Win vs. Liam Anderson by unanimous decision (3 rounds, 5:00).",
        "RCC (2/2/24): Win vs. Weldon Silva de Oliveira by KO (Punches, Round 1, 1:17).",
      ],
    },
    48: {
      bio: "Ludovit Klein, nicknamed Mr. Highlight, is a 30-year-old fighter from Nove Zamky, Slovakia. Pro debut 2014, UFC debut 2020.",
      links: [
        {
          name: "Sherdog Profile",
          url: "https://www.sherdog.com/fighter/Ludovit-Klein-183159",
        },
      ],
      lastThreeFights: [
        "UFC Fight Night (5/31/25): Loss vs. Mateusz Gamrot by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (9/28/24): Win vs. Roosevelt Roberts by unanimous decision (3 rounds, 5:00).",
        "UFC Fight Night (6/8/24): Win vs. Thiago Moises by unanimous decision (3 rounds, 5:00).",
      ],
    },
  };

  useEffect(() => {
    fetch("/fighters.json")
      .then((res) => res.json())
      .then((data) => {
        setFighters(data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load roster. Please try again.");
        setLoading(false);
        console.error("Error:", err);
      });
  }, []);

  const toggleExpand = (id) => {
    setExpandedFighter(expandedFighter === id ? null : id);
  };

  if (loading)
    return <div className="text-center text-gray-300">Loading...</div>;
  if (error) return <div className="text-center text-red-400">{error}</div>;

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center">UFC Roster</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {fighters.map((fighter) => (
          <div key={fighter.id} className="card text-center">
            <button
              onClick={() => toggleExpand(fighter.id)}
              className="text-2xl font-semibold hover:text-blue-400"
            >
              {fighter.name}
            </button>
            <p>
              Record: {fighter.wins}-{fighter.losses}-{fighter.draws}
            </p>
            {expandedFighter === fighter.id && enhancedInfos[fighter.id] && (
              <div className="mt-4 text-left">
                <p className="text-gray-300 mb-2">
                  {enhancedInfos[fighter.id].bio}
                </p>
                <h3 className="text-xl font-bold mb-2">Links</h3>
                <ul className="list-disc pl-5 mb-2">
                  {enhancedInfos[fighter.id].links.map((link, index) => (
                    <li key={index}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
                <h3 className="text-xl font-bold mb-2">Last Three Fights</h3>
                <ul className="list-disc pl-5">
                  {enhancedInfos[fighter.id].lastThreeFights.map(
                    (fight, index) => (
                      <li key={index}>{fight}</li>
                    )
                  )}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Roster;
