/* RoutePulse India — frontend-only government bus registry.
   Policy: an empty routes[] means route-level data is unavailable in this static dataset.
   Never infer route numbers, stop sequences or fares. Route records must carry source_url and verified_at.
*/
window.GOVERNMENT_BUS_DATA={
 meta:{country:'India',last_reviewed:'2026-08-16',fare_policy:'Show only fares published by the operator/source; otherwise display unavailable.'},
 states:[
  {name:'Andhra Pradesh',operators:['Andhra Pradesh State Road Transport Corporation (APSRTC)'],routes:[]},
  {name:'Arunachal Pradesh',operators:['Arunachal Pradesh State Transport Services (APSTS)'],routes:[]},
  {name:'Assam',operators:['Assam State Transport Corporation (ASTC)'],routes:[]},
  {name:'Bihar',operators:['Bihar State Road Transport Corporation (BSRTC)'],routes:[]},
  {name:'Chhattisgarh',operators:['Chhattisgarh State Road Transport Corporation'],routes:[]},
  {name:'Goa',operators:['Kadamba Transport Corporation Limited (KTCL)'],routes:[]},
  {name:'Gujarat',operators:['Gujarat State Road Transport Corporation (GSRTC)'],routes:[]},
  {name:'Haryana',operators:['Haryana Roadways'],routes:[]},
  {name:'Himachal Pradesh',operators:['Himachal Road Transport Corporation (HRTC)'],routes:[]},
  {name:'Jharkhand',operators:['Jharkhand State Road Transport Corporation (JSRTC)'],routes:[]},
  {name:'Karnataka',operators:['Karnataka State Road Transport Corporation (KSRTC)','Bengaluru Metropolitan Transport Corporation (BMTC)'],routes:[]},
  {name:'Kerala',operators:['Kerala State Road Transport Corporation (KSRTC)'],routes:[]},
  {name:'Madhya Pradesh',operators:['Madhya Pradesh State Road Transport Corporation (MPSRTC)'],routes:[]},
  {name:'Maharashtra',operators:['Maharashtra State Road Transport Corporation (MSRTC)'],routes:[]},
  {name:'Manipur',operators:['Manipur State Road Transport Corporation (MSRTC)'],routes:[]},
  {name:'Meghalaya',operators:['Meghalaya Transport Corporation (MTC)'],routes:[]},
  {name:'Mizoram',operators:['Mizoram State Transport'],routes:[]},
  {name:'Nagaland',operators:['Nagaland State Transport (NST)'],routes:[]},
  {name:'Odisha',operators:['Odisha State Road Transport Corporation (OSRTC)'],routes:[]},
  {name:'Punjab',operators:['Punjab Roadways / PUNBUS','Pepsu Road Transport Corporation (PRTC)'],routes:[]},
  {name:'Rajasthan',operators:['Rajasthan State Road Transport Corporation (RSRTC)'],routes:[]},
  {name:'Sikkim',operators:['Sikkim Nationalised Transport (SNT)'],routes:[]},
  {name:'Tamil Nadu',operators:['Tamil Nadu State Transport Corporation (TNSTC)','Metropolitan Transport Corporation (Chennai)'],routes:[]},
  {name:'Telangana',operators:['Telangana State Road Transport Corporation (TGSRTC)'],routes:[]},
  {name:'Tripura',operators:['Tripura Road Transport Corporation (TRTC)'],routes:[]},
  {name:'Uttar Pradesh',operators:['Uttar Pradesh State Road Transport Corporation (UPSRTC)'],routes:[]},
  {name:'Uttarakhand',operators:['Uttarakhand Transport Corporation (UTC)'],routes:[]},
  {name:'West Bengal',operators:['West Bengal Transport Corporation (WBTC)','North Bengal State Transport Corporation (NBSTC)','South Bengal State Transport Corporation (SBSTC)'],routes:[]},
  {name:'Andaman and Nicobar Islands',operators:['Directorate of Transport, Andaman and Nicobar Administration'],routes:[]},
  {name:'Chandigarh',operators:['Chandigarh Transport Undertaking (CTU)'],routes:[]},
  {name:'Dadra and Nagar Haveli and Daman and Diu',operators:['Transport Department, Dadra and Nagar Haveli and Daman and Diu'],routes:[]},
  {name:'Delhi',operators:['Delhi Transport Corporation (DTC)','DIMTS'],routes:[]},
  {name:'Jammu and Kashmir',operators:['Jammu and Kashmir State Road Transport Corporation (JKSRTC)'],routes:[]},
  {name:'Ladakh',operators:['Transport Department, Union Territory of Ladakh'],routes:[]},
  {name:'Lakshadweep',operators:['Transport Department, Lakshadweep Administration'],routes:[]},
  {name:'Puducherry',operators:['Puducherry Road Transport Corporation (PRTC)'],routes:[]}
 ]
};
